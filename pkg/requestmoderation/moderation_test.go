package requestmoderation

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testPolicy() Policy {
	p := DefaultPolicy()
	p.Name = "test"
	p.ID = 1
	p.Version = 1
	p.Enabled = true
	p.Channels = []int{7, 8}
	p.Keywords = []string{"attack", "渗透"}
	p.Primary = Target{ChannelID: 99, Model: "review-model", Protocol: "chat"}
	return p
}
func acceptTarget(context.Context, Target) error { return nil }

func TestExtractionAndScreening(t *testing.T) {
	for _, tc := range []struct {
		name, body, role, text string
		complete               bool
	}{
		{"chat", `{"messages":[{"role":"user","content":"hello"}],"stream":true}`, "user", "hello", true},
		{"claude", `{"system":"rules","messages":[{"role":"user","content":[{"type":"text","text":"hello"},{"type":"image","source":{"data":"SECRETBASE64"}}]}]}`, "user", "hello", false},
		{"responses", `{"input":[{"role":"user","content":[{"type":"input_text","text":"hello"}]}],"previous_response_id":"r1"}`, "user", "hello", false},
		{"gemini", `{"contents":[{"role":"user","parts":[{"text":"hello"}]}]}`, "user", "hello", true},
		{"completion", `{"prompt":"hello"}`, "user", "hello", true},
		{"tool", `{"messages":[{"role":"tool","content":"hello"}]}`, "tool", "hello", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, err := Extract([]byte(tc.body), 4096)
			require.NoError(t, err)
			require.NotEmpty(t, c.Messages)
			assert.Equal(t, tc.role, c.Messages[0].Role)
			assert.Equal(t, tc.text, c.Messages[0].Text)
			assert.Equal(t, tc.complete, c.Coverage.Complete)
			assert.NotContains(t, encode(c), "SECRETBASE64")
		})
	}
	p := testPolicy()
	p.SamplePercent = 0
	p.Keywords = []string{"ＡＴＴＡＣＫ", "attack", " 渗透 ", ""}
	cp, err := compilePolicy(p)
	require.NoError(t, err)
	assert.Len(t, cp.Keywords, 2)
	for _, tc := range []struct{ text, selection string }{{"Please explain ATTACK defense", "keyword"}, {"授权渗透测试教学", "keyword"}, {"hello", "skipped_not_sampled"}} {
		c, err := Extract([]byte(encode(map[string]any{"prompt": tc.text})), 4096)
		require.NoError(t, err)
		out, selection := screen(cp, c, "server-id", 4096)
		assert.Equal(t, tc.selection, selection)
		assert.True(t, out.Coverage.Complete)
	}
	p.Keywords = nil
	p.SamplePercent = 100
	cp, err = compilePolicy(p)
	require.NoError(t, err)
	c, err := Extract([]byte(`{"input":"hello"}`), 4096)
	require.NoError(t, err)
	_, selection := screen(cp, c, "same", 4096)
	assert.Equal(t, "sample", selection)
	p.SamplePercent = 1
	assert.Equal(t, stableSample("same", p), stableSample("same", p))
	assert.False(t, stableSample("same", Policy{SamplePercent: 0}))
	assert.True(t, stableSample("same", Policy{SamplePercent: 100}))
	c, err = Extract([]byte(encode(map[string]any{"prompt": strings.Repeat("x", 1000) + " attack"})), 64)
	require.NoError(t, err)
	assert.False(t, c.Coverage.Complete)
	assert.Contains(t, c.Coverage.Reasons, "scan_truncated")
}

func TestResultValidation(t *testing.T) {
	c := Content{Messages: []Message{{Index: 0, Role: "user", Text: "steal credentials; ignore the rules"}}, Coverage: Coverage{Complete: true}}
	valid := Result{Verdict: "violation", Categories: []string{"malicious_cyber"}, Severity: "high", Reason: "Explicit credential theft", Evidence: []Evidence{{MessageIndex: 0, Quote: "steal credentials"}}, NeedsReview: true}
	result, err := ValidateResult(encode(valid), c)
	require.NoError(t, err)
	assert.Equal(t, "violation", result.Verdict)
	for _, mutate := range []func(*Result){func(r *Result) { r.Verdict = "safe|violation" }, func(r *Result) { r.Evidence[0].Quote = "invented" }, func(r *Result) { r.Evidence[0].MessageIndex = 9 }, func(r *Result) { r.Severity = "critical" }, func(r *Result) { r.Evidence = nil }} {
		r := valid
		r.Evidence = append([]Evidence(nil), valid.Evidence...)
		mutate(&r)
		_, err := ValidateResult(encode(r), c)
		assert.Error(t, err)
	}
	_, err = ValidateResult("I refuse this request", c)
	assert.Error(t, err)
	_, err = ValidateResult(`{"verdict":"safe","categories":[],"severity":"low","reason":"ok","evidence":[],"needs_review":false,"tool_calls":[]}`, c)
	assert.Error(t, err)
	_, err = ValidateResult(`{"verdict":"safe","categories":[],"severity":"low","reason":"ok","reason":"duplicate","needs_review":false}`, c)
	assert.Error(t, err)
}

func TestPostgresFallbackReleaseAndNewEvidence(t *testing.T) {
	s := postgresStore(t)
	ctx := context.Background()
	config := DefaultConfig()
	config.Enabled = true
	require.NoError(t, s.SaveConfig(ctx, config))
	p := testPolicy()
	p.ID = 0
	p.Version = 0
	p.AutoRestrict = true
	p.ViolationCount = 1
	p.Fallback = &Target{ChannelID: 100, Model: "backup", Protocol: "chat"}
	p, err := s.SavePolicy(ctx, p, acceptTarget)
	require.NoError(t, err)
	task := persistTestTask(t, s, p, "fallback")
	e := NewEngine(s, func(_ context.Context, target Target, system, input string) (CallResult, error) {
		assert.Contains(t, system, SystemPrompt)
		assert.Contains(t, input, "attack")
		if target.ChannelID == 99 {
			return CallResult{Text: `{"verdict":"violation"}`}, nil
		}
		assert.Equal(t, *p.Fallback, target)
		return CallResult{Text: `{"verdict":"violation","categories":["malicious_cyber"],"severity":"high","reason":"explicit","evidence":[{"message_index":0,"quote":"attack"}],"needs_review":true}`, UsageKnown: true}, nil
	}, acceptTarget)
	defer e.cancel()
	claim, err := s.Claim(ctx)
	require.NoError(t, err)
	e.execute(*claim)
	detail, err := s.Detail(ctx, task.ID)
	require.NoError(t, err)
	assert.Equal(t, "retry", detail.Task.Status)
	restrictions, err := s.Restrictions(ctx, 1, 20, "active")
	require.NoError(t, err)
	assert.Empty(t, restrictions.Items)
	require.NoError(t, s.DB.Model(&Task{}).Where("id = ?", task.ID).Update("available_at", unixNow()).Error)
	claim, err = s.Claim(ctx)
	require.NoError(t, err)
	e.execute(*claim)
	restrictions, err = s.Restrictions(ctx, 1, 20, "active")
	require.NoError(t, err)
	require.Len(t, restrictions.Items, 1)
	secondNode := NewEngine(s, nil, nil)
	defer secondNode.cancel()
	require.NoError(t, secondNode.Refresh(ctx))
	assert.Equal(t, []int{7}, secondNode.ExcludedChannels(15, 19))
	r := restrictions.Items[0]
	r.ActorID = 1
	require.NoError(t, s.SaveRestriction(ctx, r, true))
	require.NoError(t, secondNode.Refresh(ctx))
	assert.Empty(t, secondNode.ExcludedChannels(15, 19))
	require.NoError(t, s.Requeue(ctx, task.ID, 1))
	claim, err = s.Claim(ctx)
	require.NoError(t, err)
	verdict := &Result{Verdict: "violation", Severity: "high", Categories: []string{"malicious_cyber"}, Evidence: []Evidence{{MessageIndex: 0, Quote: "attack"}}, Reason: "explicit"}
	require.NoError(t, s.Complete(ctx, *claim, verdict, CallResult{}, p.Primary, nil))
	restrictions, err = s.Restrictions(ctx, 1, 20, "active")
	require.NoError(t, err)
	assert.Empty(t, restrictions.Items)
	late := Task{RequestID: "late-persistence", CreatedAt: unixNow() - 5, PolicyID: p.ID, Version: p.Version, UserID: 15, TokenID: 19, ChannelID: 7}
	require.NoError(t, s.Persist(ctx, &late, Content{Messages: []Message{{Index: 0, Role: "user", Text: "attack"}}, Coverage: Coverage{Complete: true}}, p, config))
	claim, err = s.Claim(ctx)
	require.NoError(t, err)
	require.NoError(t, s.Complete(ctx, *claim, verdict, CallResult{}, p.Primary, nil))
	restrictions, err = s.Restrictions(ctx, 1, 20, "active")
	require.NoError(t, err)
	assert.Empty(t, restrictions.Items, "an old request persisted after release must not restore a restriction")
	newTask := persistTestTask(t, s, p, "new-evidence")
	require.NoError(t, s.DB.Model(&Task{}).Where("id = ?", newTask.ID).Update("created_at", unixNow()+1).Error)
	claim, err = s.Claim(ctx)
	require.NoError(t, err)
	require.NoError(t, s.Complete(ctx, *claim, verdict, CallResult{}, p.Primary, nil))
	restrictions, err = s.Restrictions(ctx, 1, 20, "active")
	require.NoError(t, err)
	assert.Len(t, restrictions.Items, 1)
}

type storageProbe struct {
	*bytes.Reader
	size   int64
	reads  int
	closed bool
}

func (s *storageProbe) Close() error { s.closed = true; return nil }
func (s *storageProbe) Bytes() ([]byte, error) {
	return nil, errors.New("must use owned bounded reader")
}
func (s *storageProbe) Size() int64  { return s.size }
func (s *storageProbe) IsDisk() bool { return false }
func (s *storageProbe) NewReader() (io.ReadCloser, error) {
	s.reads++
	copy := *s.Reader
	return io.NopCloser(&copy), nil
}

func TestCaptureAdmissionAndOwnedSnapshot(t *testing.T) {
	p, err := compilePolicy(testPolicy())
	require.NoError(t, err)
	e := NewEngine(nil, nil, nil)
	defer e.cancel()
	config := DefaultConfig()
	config.Enabled = true
	config.QueueTasks = 1
	e.state.Store(&runtimeState{config: config, policies: map[int]*compiledPolicy{7: p, 8: p}, refreshed: time.Now()})
	body := []byte(`{"messages":[{"role":"user","content":"attack"}]}`)
	storage := &storageProbe{Reader: bytes.NewReader(body), size: int64(len(body))}
	meta := Metadata{RequestID: "trusted-server-id", ChannelID: 7, Path: "/v1/chat/completions"}
	capture := e.NewCapture()
	require.True(t, capture.Observe(meta, storage))
	assert.Equal(t, 1, storage.reads)
	// A second ingress event is rejected before touching its body.
	second := e.NewCapture()
	require.False(t, second.Observe(Metadata{RequestID: "second", ChannelID: 7, Path: meta.Path}, storage))
	assert.Equal(t, 1, storage.reads)
	meta.ChannelID = 900
	require.False(t, second.Observe(meta, storage))
	assert.Equal(t, 1, storage.reads)
	storage.Close()
	body[0] = 'x'
	event := <-e.queue
	assert.Equal(t, byte('{'), event.snapshot.bytes[0])
	capture.Close()
	event.snapshot.release()
	_, used := e.QueueUsage()
	assert.Zero(t, used)
}

func postgresStore(t *testing.T) *Store {
	t.Helper()
	dsn := os.Getenv("REQUEST_MODERATION_TEST_DSN")
	if dsn == "" {
		t.Skip("set REQUEST_MODERATION_TEST_DSN to an isolated PostgreSQL database")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	schema := "moderation_test_" + strings.ToLower(common.NewRequestId())
	schema = strings.ReplaceAll(schema, "-", "")
	require.NoError(t, db.Exec("CREATE SCHEMA "+schema).Error)
	store, err := Open(dsn+" search_path="+schema, bytes.Repeat([]byte{7}, 32))
	require.NoError(t, err)
	t.Cleanup(func() {
		sqlDB, _ := store.DB.DB()
		sqlDB.Close()
		require.NoError(t, db.Exec("DROP SCHEMA "+schema+" CASCADE").Error)
		sqlDB, _ = db.DB()
		sqlDB.Close()
	})
	return store
}
func persistTestTask(t *testing.T, s *Store, p Policy, id string) Task {
	t.Helper()
	c := Content{Messages: []Message{{Index: 0, Role: "user", Text: "attack"}}, Coverage: Coverage{Complete: true}}
	task := Task{RequestID: id, PolicyID: p.ID, Version: p.Version, UserID: 15, TokenID: 19, ChannelID: 7}
	require.NoError(t, s.Persist(context.Background(), &task, c, p, DefaultConfig()))
	return task
}

func TestPostgresMigrationsLeasesAndRecovery(t *testing.T) {
	s := postgresStore(t)
	ctx := context.Background()
	require.NoError(t, s.Migrate(ctx))
	require.NoError(t, s.Migrate(ctx))
	p := testPolicy()
	p.ID = 0
	p.Version = 0
	p, err := s.SavePolicy(ctx, p, acceptTarget)
	require.NoError(t, err)
	other := testPolicy()
	other.ID = 0
	other.Version = 0
	_, err = s.SavePolicy(ctx, other, acceptTarget)
	require.Error(t, err)
	task := persistTestTask(t, s, p, "same-request")
	persistTestTask(t, s, p, "same-request")
	var count int64
	require.NoError(t, s.DB.Model(&Task{}).Count(&count).Error)
	assert.EqualValues(t, 1, count)
	config := DefaultConfig()
	config.Enabled = true
	config.GlobalConcurrency = 1
	require.NoError(t, s.SaveConfig(ctx, config))
	var claims [2]*Task
	var claimErrors [2]error
	var wg sync.WaitGroup
	for i := range 2 {
		wg.Go(func() { claims[i], claimErrors[i] = s.Claim(ctx) })
	}
	wg.Wait()
	var first *Task
	for i, claim := range claims {
		if claim != nil {
			require.Nil(t, first)
			first = claim
		} else {
			assert.ErrorIs(t, claimErrors[i], gorm.ErrRecordNotFound)
		}
	}
	require.NotNil(t, first)
	require.NoError(t, s.DB.Model(&Task{}).Where("id = ?", task.ID).Update("lease_until", unixNow()-1).Error)
	second, err := s.Claim(ctx)
	require.NoError(t, err)
	require.NotEqual(t, first.Lease, second.Lease)
	result := &Result{Verdict: "safe", Categories: []string{}, Severity: "low", Reason: "defensive context"}
	assert.ErrorContains(t, s.Complete(ctx, *first, result, CallResult{}, p.Primary, nil), "lease lost")
	require.NoError(t, s.Complete(ctx, *second, result, CallResult{InputTokens: 10, OutputTokens: 5}, p.Primary, nil))
	detail, err := s.Detail(ctx, task.ID)
	require.NoError(t, err)
	assert.Equal(t, "completed", detail.Task.Status)
	assert.Equal(t, "attack", detail.Content.Messages[0].Text)
	assert.NotContains(t, string(detail.Task.Body), "attack")
	require.NoError(t, s.Migrate(ctx))
	detail, err = s.Detail(ctx, task.ID)
	require.NoError(t, err)
	assert.Equal(t, "safe", detail.Task.Verdict)
	require.NoError(t, s.HumanReview(ctx, task.ID, 1, "safe", "authorized test"))
	require.NoError(t, s.Requeue(ctx, task.ID, 1))
	detail, err = s.Detail(ctx, task.ID)
	require.NoError(t, err)
	assert.Equal(t, "safe", detail.Task.HumanVerdict)
}

func TestPostgresBudgetPauseCleanupAndRestrictions(t *testing.T) {
	s := postgresStore(t)
	ctx := context.Background()
	p := testPolicy()
	p.ID = 0
	p.Version = 0
	p.AutoRestrict = true
	p.ViolationCount = 1
	p, err := s.SavePolicy(ctx, p, acceptTarget)
	require.NoError(t, err)
	config := DefaultConfig()
	config.Enabled = true
	config.DailyCalls = 1
	require.NoError(t, s.SaveConfig(ctx, config))
	task := persistTestTask(t, s, p, "violation-one")
	claimed, err := s.Claim(ctx)
	require.NoError(t, err)
	r := &Result{Verdict: "violation", Categories: []string{"malicious_cyber"}, Severity: "high", Reason: "test", Evidence: []Evidence{{MessageIndex: 0, Quote: "attack"}}}
	require.NoError(t, s.Complete(ctx, *claimed, r, CallResult{}, p.Primary, nil))
	list, err := s.Restrictions(ctx, 1, 20, "active")
	require.NoError(t, err)
	require.Len(t, list.Items, 1)
	manual := Restriction{Subject: "user", SubjectID: 15, ChannelID: 7, Reason: "Independent decision", ActorID: 2, SourceTaskID: task.ID}
	require.NoError(t, s.SaveRestriction(ctx, manual, false))
	require.NoError(t, s.HumanReview(ctx, task.ID, 1, "safe", "false positive"))
	list, err = s.Restrictions(ctx, 1, 20, "active")
	require.NoError(t, err)
	require.Len(t, list.Items, 1)
	assert.False(t, list.Items[0].Automatic)
	second := persistTestTask(t, s, p, "request-two")
	_, err = s.Claim(ctx)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
	var saved Task
	require.NoError(t, s.DB.First(&saved, second.ID).Error)
	assert.Equal(t, "budget_paused", saved.Status)
	require.NoError(t, s.DB.Model(&Task{}).Where("id = ?", second.ID).Updates(map[string]any{"expires_at": unixNow() - 1, "body_expires_at": unixNow() - 1}).Error)
	require.NoError(t, s.Cleanup(ctx, config))
	detail, err := s.Detail(ctx, second.ID)
	require.NoError(t, err)
	assert.Nil(t, detail.Content)
	assert.Equal(t, "expired", detail.Task.Status)
	assert.Error(t, s.Requeue(ctx, second.ID, 1))
	e := NewEngine(s, nil, acceptTarget)
	defer e.cancel()
	require.NoError(t, e.Refresh(ctx))
	assert.Equal(t, []int{7}, e.ExcludedChannels(15, 19))
	state := e.state.Load()
	state.refreshed = time.Now().Add(-CacheLifetime)
	assert.Empty(t, e.ExcludedChannels(15, 19))
}

func TestBlockedReviewDoesNotDelaySSEOrHoldTransaction(t *testing.T) {
	s := postgresStore(t)
	ctx := context.Background()
	p := testPolicy()
	p.ID = 0
	p.Version = 0
	p, err := s.SavePolicy(ctx, p, acceptTarget)
	require.NoError(t, err)
	config := DefaultConfig()
	config.Enabled = true
	require.NoError(t, s.SaveConfig(ctx, config))
	entered := make(chan struct{})
	release := make(chan struct{})
	done := make(chan struct{})
	e := NewEngine(s, func(ctx context.Context, _ Target, system, input string) (CallResult, error) {
		close(entered)
		defer close(done)
		select {
		case <-release:
			return CallResult{Text: `{"verdict":"safe","categories":[],"severity":"low","reason":"authorized","evidence":[],"needs_review":false}`}, nil
		case <-ctx.Done():
			return CallResult{}, ctx.Err()
		}
	}, acceptTarget)
	require.NoError(t, e.Start())
	t.Cleanup(func() {
		close(release)
		shutdown, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		e.Stop(shutdown)
	})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		storage, err := common.CreateBodyStorage([]byte(`{"messages":[{"role":"user","content":"attack"}],"stream":true}`))
		if err != nil {
			http.Error(w, "storage", 500)
			return
		}
		defer storage.Close()
		capture := e.NewCapture()
		defer capture.Close()
		if !capture.Observe(Metadata{RequestID: "blocking-sse", ChannelID: 7, Path: "/v1/chat/completions"}, storage) {
			http.Error(w, "capture", 500)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		io.WriteString(w, "data: business\n\n")
		w.(http.Flusher).Flush()
		<-r.Context().Done()
	}))
	defer server.Close()
	requestCtx, disconnect := context.WithCancel(ctx)
	defer disconnect()
	request, err := http.NewRequestWithContext(requestCtx, http.MethodGet, server.URL, nil)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(request)
	require.NoError(t, err)
	defer resp.Body.Close()
	<-entered
	chunk := make([]byte, len("data: business\n\n"))
	_, err = io.ReadFull(resp.Body, chunk)
	require.NoError(t, err)
	assert.Equal(t, "data: business\n\n", string(chunk))
	disconnect()
	select {
	case <-done:
		t.Fatal("business disconnect cancelled review")
	default:
	}
	// Saving configuration locks the scheduler row. It must complete while
	// the upstream remains deliberately blocked, without timing assertions.
	deadline, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	require.NoError(t, s.SaveConfig(deadline, config))
}

func TestDiskSnapshotSurvivesCleanupAndRetryMutation(t *testing.T) {
	old := common.GetDiskCacheConfig()
	common.SetDiskCacheConfig(common.DiskCacheConfig{Enabled: true, ThresholdMB: 0, MaxSizeMB: 10, Path: t.TempDir()})
	t.Cleanup(func() { common.SetDiskCacheConfig(old) })
	body := []byte(`{"input":"original attack"}`)
	storage, err := common.CreateBodyStorage(body)
	require.NoError(t, err)
	require.True(t, storage.IsDisk())
	p, err := compilePolicy(testPolicy())
	require.NoError(t, err)
	other := testPolicy()
	other.ID = 2
	other.Version = 3
	other.Channels = []int{9}
	p2, err := compilePolicy(other)
	require.NoError(t, err)
	e := NewEngine(nil, nil, nil)
	defer e.cancel()
	config := DefaultConfig()
	config.Enabled = true
	e.state.Store(&runtimeState{config: config, policies: map[int]*compiledPolicy{7: p, 8: p, 9: p2}, refreshed: time.Now()})
	capture := e.NewCapture()
	meta := Metadata{RequestID: "disk", ChannelID: 7, Path: "/v1/responses"}
	require.True(t, capture.Observe(meta, storage))
	require.NoError(t, storage.Close())
	changed, err := common.CreateBodyStorage([]byte(`{"input":"channel override"}`))
	require.NoError(t, err)
	defer changed.Close()
	meta.ChannelID = 8
	meta.Attempt = 1
	require.True(t, capture.Observe(meta, changed))
	meta.ChannelID = 9
	meta.Attempt = 2
	require.True(t, capture.Observe(meta, changed))
	capture.Close()
	first := <-e.queue
	attempt := <-e.queue
	second := <-e.queue
	require.NotNil(t, attempt.attempt)
	assert.Same(t, first.snapshot, second.snapshot)
	assert.Equal(t, string(body), string(second.snapshot.bytes))
	assert.EqualValues(t, 2, second.policy.ID)
	first.snapshot.release()
	second.snapshot.release()
	_, used := e.QueueUsage()
	assert.Zero(t, used)
}

func TestPostgresCapacityDisableAndUsageAccounting(t *testing.T) {
	s := postgresStore(t)
	ctx := context.Background()
	engine := NewEngine(s, nil, nil)
	defer engine.cancel()
	engine.persist(event{attempt: &Attempt{RequestID: "not-sampled", ChannelID: 7, Outcome: "relay_completed"}})
	var attempts int64
	require.NoError(t, s.DB.Model(&Attempt{}).Count(&attempts).Error)
	assert.Zero(t, attempts)
	p := testPolicy()
	p.ID = 0
	p.Version = 0
	p, err := s.SavePolicy(ctx, p, acceptTarget)
	require.NoError(t, err)
	config := DefaultConfig()
	config.Enabled = true
	config.MaxPendingTasks = 1
	require.NoError(t, s.SaveConfig(ctx, config))
	persistTestTask(t, s, p, "first")
	duplicate := persistTestTask(t, s, p, "first")
	assert.Positive(t, duplicate.ID)
	other := Task{RequestID: "full", PolicyID: p.ID, Version: p.Version}
	assert.ErrorIs(t, s.Persist(ctx, &other, Content{}, p, config), ErrStorageCapacity)
	claimed, err := s.Claim(ctx)
	require.NoError(t, err)
	require.NoError(t, s.PauseClaim(ctx, *claimed))
	var budget Budget
	require.NoError(t, s.DB.First(&budget).Error)
	assert.Zero(t, budget.Calls)
	claimed, err = s.Claim(ctx)
	require.NoError(t, err)
	require.NoError(t, s.DB.Model(&Task{}).Where("id = ?", claimed.ID).Update("lease_until", unixNow()-1).Error)
	replacement, err := s.Claim(ctx)
	require.NoError(t, err)
	r := &Result{Verdict: "safe", Categories: []string{}, Severity: "low", Reason: "authorized"}
	assert.ErrorContains(t, s.Complete(ctx, *claimed, r, CallResult{InputTokens: 11, OutputTokens: 3, UsageKnown: true}, p.Primary, nil), "lease lost")
	assert.ErrorContains(t, s.Complete(ctx, *claimed, r, CallResult{InputTokens: 11, OutputTokens: 3, UsageKnown: true}, p.Primary, nil), "lease lost")
	require.NoError(t, s.Complete(ctx, *replacement, r, CallResult{}, p.Primary, nil))
	require.NoError(t, s.DB.First(&budget).Error)
	assert.EqualValues(t, 14, budget.Tokens)
	assert.EqualValues(t, 1, budget.UnknownCalls)
	assert.Equal(t, replacement.TokenReservation, budget.ReservedTokens)
	config.DailyTokens = budget.Tokens + budget.ReservedTokens
	require.NoError(t, s.SaveConfig(ctx, config))
	persistTestTask(t, s, p, "token-budget")
	_, err = s.Claim(ctx)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	var paused Task
	require.NoError(t, s.DB.Where("request_id = ?", "token-budget").First(&paused).Error)
	assert.Equal(t, "budget_paused", paused.Status)
	p.Enabled = false
	_, err = s.SavePolicy(ctx, p, func(context.Context, Target) error { return errors.New("deleted channel") })
	require.NoError(t, err)
}

// BenchmarkCapture measures the added gateway hot path independently of
// upstream/network latency. Run with -benchtime=3000x -benchmem; the separate
// blocked-review regression above exercises the real PostgreSQL worker path.
func BenchmarkCapture(b *testing.B) {
	for _, scenario := range []string{"disabled_short", "enabled_short", "disabled_long", "enabled_long", "disk_long", "retry_long", "sse_short", "blocked_reviewer", "queue_full"} {
		b.Run(scenario, func(b *testing.B) {
			config := DefaultConfig()
			config.Enabled = !strings.HasPrefix(scenario, "disabled")
			p, err := compilePolicy(testPolicy())
			require.NoError(b, err)
			e := NewEngine(nil, nil, nil)
			defer e.cancel()
			e.state.Store(&runtimeState{config: config, policies: map[int]*compiledPolicy{7: p, 8: p}, refreshed: time.Now()})
			length := 1024
			if strings.Contains(scenario, "long") {
				length = 1 << 20
			}
			body := []byte(`{"messages":[{"role":"user","content":"` + strings.Repeat("x", length) + `"}],"stream":true}`)
			if scenario == "disk_long" {
				old := common.GetDiskCacheConfig()
				common.SetDiskCacheConfig(common.DiskCacheConfig{Enabled: true, ThresholdMB: 0, MaxSizeMB: 16, Path: b.TempDir()})
				defer common.SetDiskCacheConfig(old)
			}
			storage, err := common.CreateBodyStorage(body)
			require.NoError(b, err)
			defer storage.Close()
			if scenario == "queue_full" {
				e.tasks = config.QueueTasks
			}
			latencies := make([]int64, b.N)
			accepted := 0
			b.ReportAllocs()
			b.SetBytes(int64(len(body)))
			b.ResetTimer()
			for i := range b.N {
				start := time.Now()
				capture := e.NewCapture()
				meta := Metadata{RequestID: "benchmark", ChannelID: 7, Path: "/v1/chat/completions"}
				if capture.Observe(meta, storage) {
					accepted++
				}
				if scenario == "retry_long" {
					meta.ChannelID = 8
					meta.Attempt = 1
					capture.Observe(meta, storage)
				}
				if scenario == "sse_short" {
					writer := httptest.NewRecorder()
					io.WriteString(writer, "data: business\n\n")
					writer.Flush()
				}
				capture.Close()
				latencies[i] = time.Since(start).Nanoseconds()
				b.StopTimer()
				// An unavailable reviewer keeps events queued; the other scenarios
				// isolate successful handoff and release capacity between requests.
				if scenario != "blocked_reviewer" {
					for len(e.queue) > 0 {
						item := <-e.queue
						if item.snapshot != nil {
							item.snapshot.release()
						}
						e.tasks--
					}
				}
				// Model the separate cache refresher outside the timed hot path.
				// This benchmark must not turn into a stale-cache fail-open run.
				e.state.Load().refreshed = time.Now()
				b.StartTimer()
			}
			b.StopTimer()
			slices.Sort(latencies)
			for name, percent := range map[string]int{"p50-ns": 50, "p95-ns": 95, "p99-ns": 99} {
				b.ReportMetric(float64(latencies[min(len(latencies)-1, len(latencies)*percent/100)]), name)
			}
			b.ReportMetric(float64(accepted), "accepted")
			b.ReportMetric(float64(b.N-accepted), "uncollected")
			_, queuedBytes := e.QueueUsage()
			b.ReportMetric(float64(queuedBytes), "queued-bytes")
		})
	}
}
