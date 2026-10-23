package requestmoderation

import (
	"context"
	"errors"
	"io"
	"slices"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const CacheLifetime = 5 * time.Second

type runtimeState struct {
	config       Config
	policies     map[int]*compiledPolicy
	restrictions map[string][]Restriction
	refreshed    time.Time
}
type Engine struct {
	Store          *Store
	Call           Caller
	ValidateTarget TargetValidator
	state          atomic.Pointer[runtimeState]
	queue          chan event
	mu             sync.Mutex
	bytes          int64
	tasks          int
	stopping       bool
	stats          sync.Map
	ctx            context.Context
	cancel         context.CancelFunc
	wg             sync.WaitGroup
	ingress        sync.WaitGroup
	refreshMu      sync.Mutex
}
type Metadata struct {
	RequestID string
	StartedAt int64
	UserID    int
	TokenID   int
	Group     string
	Model     string
	Path      string
	ChannelID int
	Attempt   int
}
type snapshot struct {
	bytes  []byte
	refs   atomic.Int64
	engine *Engine
}
type Capture struct {
	engine   *Engine
	snapshot *snapshot
	seen     map[string]bool
}
type event struct {
	meta     Metadata
	snapshot *snapshot
	policy   *compiledPolicy
	config   Config
	attempt  *Attempt
}

var active atomic.Pointer[Engine]

func Active() *Engine     { return active.Load() }
func SetActive(e *Engine) { active.Store(e) }

func NewEngine(store *Store, call Caller, validate TargetValidator) *Engine {
	ctx, cancel := context.WithCancel(context.Background())
	return &Engine{Store: store, Call: call, ValidateTarget: validate, queue: make(chan event, 4096), ctx: ctx, cancel: cancel}
}
func (e *Engine) Start() error {
	if err := e.Refresh(e.ctx); err != nil {
		return err
	}
	e.ingress.Go(e.consume)
	// Fixed upper bound; live configuration gates how many workers may claim.
	for i := range 16 {
		e.wg.Go(func() { e.work(i) })
	}
	e.wg.Go(e.maintain)
	return nil
}
func (e *Engine) Stop(ctx context.Context) {
	e.mu.Lock()
	e.stopping = true
	e.mu.Unlock()
	drained := make(chan struct{})
	go func() { e.ingress.Wait(); close(drained) }()
	select {
	case <-drained:
	case <-ctx.Done():
	}
	e.cancel()
	done := make(chan struct{})
	go func() { e.wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-ctx.Done():
	}
}
func (e *Engine) Refresh(ctx context.Context) error {
	e.refreshMu.Lock()
	defer e.refreshMu.Unlock()
	c, err := e.Store.Config(ctx)
	if err != nil {
		return err
	}
	if err = c.Validate(); err != nil {
		return err
	}
	policies, err := e.Store.Policies(ctx)
	if err != nil {
		return err
	}
	state := &runtimeState{config: c, policies: map[int]*compiledPolicy{}, restrictions: map[string][]Restriction{}, refreshed: time.Now()}
	old := e.state.Load()
	for _, p := range policies {
		if !p.Enabled {
			continue
		}
		var compiled *compiledPolicy
		if old != nil {
			for _, id := range p.Channels {
				if cached := old.policies[id]; cached != nil && cached.ID == p.ID && cached.Version == p.Version {
					compiled = cached
					break
				}
			}
		}
		if compiled == nil {
			compiled, err = compilePolicy(p)
			if err != nil {
				return err
			}
		}
		for _, id := range p.Channels {
			state.policies[id] = compiled
		}
	}
	var restrictions []Restriction
	if err = e.Store.DB.WithContext(ctx).Where("released_at = 0 AND (expires_at = 0 OR expires_at > ?)", unixNow()).Limit(100001).Find(&restrictions).Error; err != nil {
		return err
	}
	if len(restrictions) > 100000 {
		return errors.New("moderation restriction cache capacity exceeded")
	}
	for _, r := range restrictions {
		key := r.Subject + ":" + strconv.Itoa(r.SubjectID)
		state.restrictions[key] = append(state.restrictions[key], r)
	}
	e.state.Store(state)
	// Keep queued tasks visibly paused without changing their policy snapshot.
	q := e.Store.DB.WithContext(ctx).Model(&Task{}).Where("is_test = ? AND status IN ?", false, []string{"pending", "retry", "budget_paused"})
	if c.Enabled {
		q = q.Where("policy_id NOT IN (?)", e.Store.DB.Model(&PolicyRow{}).Select("id").Where("enabled = ?", true))
	}
	if err := q.Update("status", "paused").Error; err != nil {
		return err
	}
	return nil
}
func (e *Engine) Count(name string, n int64) {
	value, _ := e.stats.LoadOrStore(name, &atomic.Int64{})
	value.(*atomic.Int64).Add(n)
}
func (e *Engine) Counters() map[string]int64 {
	result := map[string]int64{}
	e.stats.Range(func(k, v any) bool { result[k.(string)] = v.(*atomic.Int64).Load(); return true })
	return result
}
func (e *Engine) Config() Config {
	state := e.state.Load()
	if state == nil {
		return DefaultConfig()
	}
	return state.config
}
func (e *Engine) Healthy() bool {
	state := e.state.Load()
	return state != nil && time.Since(state.refreshed) < CacheLifetime
}
func (e *Engine) QueueUsage() (int, int64) { e.mu.Lock(); defer e.mu.Unlock(); return e.tasks, e.bytes }

// ExcludedChannels is a memory-only lookup. A stale node fails open within
// five seconds, so a disconnected node cannot retain an administrator's
// released restriction indefinitely. Existing calls are never cancelled.
func (e *Engine) ExcludedChannels(userID, tokenID int) []int {
	state := e.state.Load()
	if state == nil || time.Since(state.refreshed) >= CacheLifetime {
		return nil
	}
	var ids []int
	for _, key := range []string{"user:" + strconv.Itoa(userID), "token:" + strconv.Itoa(tokenID)} {
		for _, r := range state.restrictions[key] {
			if r.ExpiresAt == 0 || r.ExpiresAt > unixNow() {
				if !slices.Contains(ids, r.ChannelID) {
					ids = append(ids, r.ChannelID)
				}
			}
		}
	}
	return ids
}
func (e *Engine) NewCapture() *Capture { return &Capture{engine: e} }
func (s *snapshot) release() {
	if s.refs.Add(-1) == 0 {
		s.engine.mu.Lock()
		s.engine.bytes -= int64(len(s.bytes))
		s.engine.mu.Unlock()
	}
}
func (c *Capture) Close() {
	if c != nil && c.snapshot != nil {
		c.snapshot.release()
		c.snapshot = nil
	}
}

// Observe admits the event before allocating or reading the body. There is
// no database, keyword scan, background goroutine or network operation here.
// BodyStorage.Bytes is not retained: the snapshot owns its bounded copy.
func (c *Capture) Observe(meta Metadata, storage common.BodyStorage) bool {
	if c == nil || storage == nil || !SupportedPath(meta.Path) {
		return false
	}
	if meta.StartedAt <= 0 {
		meta.StartedAt = unixNow()
	}
	e := c.engine
	state := e.state.Load()
	if state == nil || !state.config.Enabled || time.Since(state.refreshed) >= CacheLifetime {
		return false
	}
	p := state.policies[meta.ChannelID]
	if p == nil || (len(p.Models) > 0 && !slices.Contains(p.Models, meta.Model)) {
		return false
	}
	e.Count("monitored", 1)
	key := strconv.FormatInt(p.ID, 10) + ":" + strconv.FormatInt(p.Version, 10)
	if c.seen[key] {
		e.enqueueAttempt(Attempt{RequestID: meta.RequestID, Number: meta.Attempt, ChannelID: meta.ChannelID, SelectedAt: unixNow(), Outcome: "selected"})
		return true
	}
	size := storage.Size()
	if size < 0 || size > state.config.MaxBodyBytes {
		e.Count("dropped_body_size", 1)
		return false
	}
	if !e.mu.TryLock() {
		e.Count("dropped_ingress_busy", 1)
		return false
	}
	addedBytes := size
	if c.snapshot != nil {
		addedBytes = 0
	}
	if e.stopping || e.tasks >= state.config.QueueTasks || e.bytes+addedBytes > state.config.QueueBytes {
		e.mu.Unlock()
		e.Count("dropped_queue_full", 1)
		return false
	}
	e.tasks++
	e.bytes += addedBytes
	e.mu.Unlock()
	if c.snapshot == nil {
		reader, err := storage.NewReader()
		var data []byte
		if err == nil {
			data = make([]byte, int(size))
			_, err = io.ReadFull(reader, data)
			reader.Close()
		}
		if err != nil {
			e.mu.Lock()
			e.tasks--
			e.bytes -= size
			e.mu.Unlock()
			e.Count("dropped_snapshot", 1)
			return false
		}
		c.snapshot = &snapshot{bytes: data, engine: e}
		c.snapshot.refs.Store(1)
	}
	c.snapshot.refs.Add(1)
	select {
	case e.queue <- event{meta: meta, snapshot: c.snapshot, policy: p, config: state.config}:
		if c.seen == nil {
			c.seen = map[string]bool{}
		}
		c.seen[key] = true
		return true
	default:
		c.snapshot.release()
		e.mu.Lock()
		e.tasks--
		e.mu.Unlock()
		e.Count("dropped_queue_full", 1)
		return false
	}
}
func (e *Engine) enqueueAttempt(a Attempt) {
	if !e.mu.TryLock() {
		e.Count("dropped_attempt", 1)
		return
	}
	if e.stopping || e.tasks >= e.Config().QueueTasks {
		e.mu.Unlock()
		e.Count("dropped_attempt", 1)
		return
	}
	e.tasks++
	e.mu.Unlock()
	select {
	case e.queue <- event{attempt: &a}:
	default:
		e.mu.Lock()
		e.tasks--
		e.mu.Unlock()
		e.Count("dropped_attempt", 1)
	}
}
func (c *Capture) Finish(meta Metadata, status int, success bool) {
	if c == nil {
		return
	}
	outcome := "relay_failed"
	if success {
		outcome = "relay_completed"
	}
	c.engine.enqueueAttempt(Attempt{RequestID: meta.RequestID, Number: meta.Attempt, ChannelID: meta.ChannelID, SelectedAt: unixNow(), Outcome: outcome, StatusCode: status})
}

func (e *Engine) consume() {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			e.mu.Lock()
			stop := e.stopping && e.tasks == 0
			e.mu.Unlock()
			if stop {
				return
			}
		case item := <-e.queue:
			e.persist(item)
			if item.snapshot != nil {
				item.snapshot.release()
			}
			e.mu.Lock()
			e.tasks--
			e.mu.Unlock()
		}
	}
}
func (e *Engine) persist(item event) {
	defer func() {
		if recover() != nil {
			e.Count("dropped_snapshot", 1)
		}
	}()
	ctx, cancel := context.WithTimeout(e.ctx, 3*time.Second)
	defer cancel()
	if item.attempt != nil {
		// Unselected requests retain aggregate counters only, including retries.
		var taskID int64
		if err := e.Store.DB.WithContext(ctx).Model(&Task{}).Where("request_id = ?", item.attempt.RequestID).Limit(1).Pluck("id", &taskID).Error; err != nil {
			e.Count("dropped_attempt", 1)
			return
		}
		if taskID == 0 {
			return
		}
		if err := e.Store.DB.WithContext(ctx).Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "request_id"}, {Name: "number"}}, DoUpdates: clause.AssignmentColumns([]string{"outcome", "status_code"})}).Create(item.attempt).Error; err != nil {
			e.Count("dropped_attempt", 1)
		}
		return
	}
	content, err := Extract(item.snapshot.bytes, item.config.ScanBytes)
	selection := "parse_failed"
	if err != nil {
		content.partial("parse_failed")
		e.Count("parse_failed", 1)
	} else {
		content, selection = screen(item.policy, content, item.meta.RequestID, item.config.ReviewBytes)
	}
	e.Count(selection, 1)
	if selection == "skipped_not_sampled" {
		return
	}
	t := &Task{RequestID: item.meta.RequestID, CreatedAt: item.meta.StartedAt, PolicyID: item.policy.ID, Version: item.policy.Version, UserID: item.meta.UserID, TokenID: item.meta.TokenID, Group: item.meta.Group, Model: item.meta.Model, ChannelID: item.meta.ChannelID, Selection: selection}
	if err = e.Store.Persist(ctx, t, content, item.policy.Policy, item.config); err != nil {
		if errors.Is(err, ErrStorageCapacity) {
			e.Count("dropped_storage_capacity", 1)
		} else {
			e.Count("dropped_database", 1)
		}
		return
	}
	e.Count("enqueued", 1)
	a := Attempt{RequestID: item.meta.RequestID, Number: item.meta.Attempt, ChannelID: item.meta.ChannelID, SelectedAt: unixNow(), Outcome: "selected"}
	if err = e.Store.DB.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&a).Error; err != nil {
		e.Count("dropped_attempt", 1)
	}
}
func (e *Engine) work(index int) {
	ticker := time.NewTicker(300 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
		}
		if index >= e.Config().Workers || !e.Healthy() {
			continue
		}
		e.mu.Lock()
		stopping := e.stopping
		e.mu.Unlock()
		if stopping {
			return
		}
		ctx, cancel := context.WithTimeout(e.ctx, 3*time.Second)
		task, err := e.Store.Claim(ctx)
		cancel()
		if err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				e.Count("worker_database_error", 1)
			}
			continue
		}
		e.execute(*task)
	}
}
func (e *Engine) execute(t Task) {
	defer func() {
		if recover() != nil {
			e.Count("model_failed", 1)
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			_ = e.Store.Complete(ctx, t, nil, CallResult{}, Target{}, errors.New("review_worker_panic"))
		}
	}()
	var p Policy
	var content Content
	err := common.UnmarshalJsonStr(t.Snapshot, &p)
	if err == nil {
		err = e.Store.open(t.Body, &content)
	}
	call := CallResult{}
	target := p.Primary
	if t.Attempts > 1 && p.Fallback != nil {
		target = *p.Fallback
	}
	var result *Result
	if err == nil {
		ctx, cancel := context.WithTimeout(e.ctx, time.Duration(p.TimeoutSeconds)*time.Second)
		// Re-read enabled state immediately before the model call. Policy
		// changes do not rewrite the task's immutable rules and target.
		var row PolicyRow
		if !t.IsTest {
			err = e.Store.DB.WithContext(ctx).First(&row, t.PolicyID).Error
			config, configErr := e.Store.Config(ctx)
			if configErr != nil {
				err = configErr
			}
			if err == nil && (!row.Enabled || !config.Enabled) {
				if pauseErr := e.Store.PauseClaim(ctx, t); pauseErr != nil {
					e.Count("completion_error", 1)
				}
				cancel()
				return
			}
		}
		if err == nil {
			call, err = e.Call(ctx, target, SystemPrompt+"\n审核标准：\n"+p.Rules, encode(content))
		}
		cancel()
		if err == nil {
			result, err = ValidateResult(call.Text, content)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if saveErr := e.Store.Complete(ctx, t, result, call, target, err); saveErr != nil {
		e.Count("completion_error", 1)
	}
	if err == nil {
		e.Count("model_completed", 1)
	} else {
		e.Count("model_failed", 1)
	}
}
func (e *Engine) maintain() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	tick := 0
	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
		}
		ctx, cancel := context.WithTimeout(e.ctx, 2*time.Second)
		err := e.Refresh(ctx)
		cancel()
		if err != nil {
			e.Count("refresh_error", 1)
		}
		tick++
		if tick%30 != 0 {
			continue
		}
		ctx, cancel = context.WithTimeout(e.ctx, 5*time.Second)
		if err = e.Store.Cleanup(ctx, e.Config()); err != nil {
			e.Count("cleanup_error", 1)
		}
		day := time.Now().UTC().Format("2006-01-02")
		e.stats.Range(func(k, v any) bool {
			count := v.(*atomic.Int64).Swap(0)
			if count == 0 {
				return true
			}
			counter := Counter{Day: day, Name: k.(string), Value: count}
			err := e.Store.DB.WithContext(ctx).Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "day"}, {Name: "name"}}, DoUpdates: clause.Assignments(map[string]any{"value": gorm.Expr("request_moderation_counters.value + ?", count)})}).Create(&counter).Error
			if err != nil {
				v.(*atomic.Int64).Add(count)
			}
			return true
		})
		cancel()
	}
}
