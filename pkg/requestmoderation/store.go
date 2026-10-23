package requestmoderation

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

type Store struct {
	DB     *gorm.DB
	cipher cipher.AEAD
}

var ErrStorageCapacity = errors.New("moderation_storage_capacity")

// Open uses an independent PostgreSQL pool. The caller must never pass the
// main/log database handle; moderation migrations cannot touch either schema.
func Open(dsn string, key []byte) (*Store, error) {
	if len(key) != 32 {
		return nil, errors.New("REQUEST_MODERATION_ENCRYPTION_KEY must contain 32 base64-decoded bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent), DisableAutomaticPing: true})
	if err != nil {
		return nil, errors.New("moderation PostgreSQL connection failed")
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetMaxIdleConns(4)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err = sqlDB.PingContext(ctx); err != nil {
		sqlDB.Close()
		return nil, errors.New("moderation PostgreSQL is unavailable")
	}
	s := &Store{DB: db, cipher: aead}
	if err = s.Migrate(ctx); err != nil {
		sqlDB.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Migrate(ctx context.Context) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Serialize module migrations across gateway instances, PostgreSQL 9.6+.
		if err := tx.Exec("SELECT pg_advisory_xact_lock(728314981)").Error; err != nil {
			return err
		}
		if err := tx.AutoMigrate(&ConfigRow{}, &PolicyRow{}, &Binding{}, &Task{}, &History{}, &Attempt{}, &Restriction{}, &Counter{}, &Budget{}); err != nil {
			return err
		}
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&ConfigRow{ID: 1, Payload: encode(DefaultConfig())}).Error
	})
}

func (s *Store) seal(v any) ([]byte, error) {
	data, err := common.Marshal(v)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, s.cipher.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return nil, err
	}
	return s.cipher.Seal(nonce, nonce, data, []byte("request_moderation:v1")), nil
}
func (s *Store) open(data []byte, v any) error {
	if len(data) < s.cipher.NonceSize() {
		return errors.New("moderation body has expired")
	}
	n := s.cipher.NonceSize()
	plain, err := s.cipher.Open(nil, data[:n], data[n:], []byte("request_moderation:v1"))
	if err != nil {
		return errors.New("moderation data cannot be decrypted")
	}
	return common.Unmarshal(plain, v)
}
func (s *Store) Config(ctx context.Context) (Config, error) {
	var row ConfigRow
	var c Config
	if err := s.DB.WithContext(ctx).First(&row, 1).Error; err != nil {
		return c, err
	}
	err := common.UnmarshalJsonStr(row.Payload, &c)
	return c, err
}
func (s *Store) SaveConfig(ctx context.Context, c Config) error {
	if err := c.Validate(); err != nil {
		return err
	}
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&ConfigRow{}).Where("id = 1").Update("payload", encode(c)).Error; err != nil {
			return err
		}
		return tx.Model(&Task{}).Where("status = ?", "budget_paused").Update("available_at", unixNow()).Error
	})
}
func (s *Store) Policies(ctx context.Context) ([]Policy, error) {
	var rows []PolicyRow
	result := make([]Policy, 0)
	if err := s.DB.WithContext(ctx).Order("id").Limit(257).Find(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) > 256 {
		return nil, errors.New("moderation policy capacity exceeded")
	}
	for _, row := range rows {
		var p Policy
		if err := common.UnmarshalJsonStr(row.Payload, &p); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, nil
}
func (s *Store) SavePolicy(ctx context.Context, p Policy, validate TargetValidator) (Policy, error) {
	compiled, err := compilePolicy(p)
	if err != nil {
		return p, err
	}
	p = compiled.Policy
	// Disabling must remain possible when a previously valid channel is gone.
	if p.Enabled || p.ID == 0 {
		if err = validate(ctx, p.Primary); err != nil {
			return p, err
		}
		if p.Fallback != nil {
			if err = validate(ctx, *p.Fallback); err != nil {
				return p, err
			}
		}
	}
	err = s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var lock ConfigRow
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&lock, 1).Error; err != nil {
			return err
		}
		var row PolicyRow
		if p.ID != 0 {
			if err := tx.First(&row, p.ID).Error; err != nil {
				return err
			}
			if row.Version != p.Version {
				return errors.New("moderation policy changed; reload before saving")
			}
		} else {
			var n int64
			if err := tx.Model(&PolicyRow{}).Count(&n).Error; err != nil {
				return err
			}
			if n >= 256 {
				return errors.New("moderation policy capacity exceeded")
			}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
			p.ID = row.ID
		}
		p.Version = row.Version + 1
		if err := tx.Where("policy_id = ?", p.ID).Delete(&Binding{}).Error; err != nil {
			return err
		}
		if p.Enabled {
			for _, id := range p.Channels {
				var existing Binding
				err := tx.First(&existing, "channel_id = ?", id).Error
				if err == nil {
					return fmt.Errorf("business channel %d already has an enabled moderation policy", id)
				}
				if !errors.Is(err, gorm.ErrRecordNotFound) {
					return err
				}
				if err := tx.Create(&Binding{ChannelID: id, PolicyID: p.ID}).Error; err != nil {
					return err
				}
			}
		}
		return tx.Model(&row).Updates(map[string]any{"version": p.Version, "enabled": p.Enabled, "payload": encode(p)}).Error
	})
	return p, err
}

func (s *Store) Persist(ctx context.Context, t *Task, c Content, p Policy, config Config) error {
	body, err := s.seal(c)
	if err != nil {
		return err
	}
	t.Body = body
	t.Snapshot = encode(p)
	t.Status = "pending"
	t.Complete = c.Coverage.Complete
	if t.CreatedAt <= 0 {
		t.CreatedAt = unixNow()
	}
	t.ExpiresAt = t.CreatedAt + int64(config.PendingHours)*3600
	t.BodyExpiresAt = t.CreatedAt + int64(config.BodyHours)*3600
	t.AvailableAt = t.CreatedAt
	t.NeedsReview = true
	if len(c.Messages) == 0 {
		t.Status = "failed"
		t.Error = "unsupported_or_empty_text"
	}
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row ConfigRow
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&row, 1).Error; err != nil {
			return err
		}
		var current Config
		if err := common.UnmarshalJsonStr(row.Payload, &current); err != nil {
			return err
		}
		var existing Task
		err := tx.Select("id").Where("request_id = ? AND policy_id = ? AND version = ?", t.RequestID, t.PolicyID, t.Version).Take(&existing).Error
		if err == nil {
			t.ID = existing.ID
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if row.StoredBytes+int64(len(body)) > current.MaxStoredBytes {
			return ErrStorageCapacity
		}
		var pending int64
		if err := tx.Model(&Task{}).Where("status IN ?", []string{"pending", "running", "retry", "paused", "budget_paused"}).Count(&pending).Error; err != nil {
			return err
		}
		if pending >= int64(current.MaxPendingTasks) {
			return ErrStorageCapacity
		}
		if err := tx.Create(t).Error; err != nil {
			return err
		}
		return tx.Model(&row).UpdateColumn("stored_bytes", gorm.Expr("stored_bytes + ?", len(body))).Error
	})
}

// Claim serializes only scheduling, never the upstream call. Lease fencing is
// checked by every completion and renewal. SKIP LOCKED is not required.
func (s *Store) Claim(ctx context.Context) (*Task, error) {
	var task Task
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row ConfigRow
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&row, 1).Error; err != nil {
			return err
		}
		var config Config
		if err := common.UnmarshalJsonStr(row.Payload, &config); err != nil {
			return err
		}
		now := unixNow()
		var count int64
		if err := tx.Model(&Task{}).Where("status = ? AND lease_until > ?", "running", now).Count(&count).Error; err != nil {
			return err
		}
		if count >= int64(config.GlobalConcurrency) {
			return gorm.ErrRecordNotFound
		}
		q := tx.Where("body_expires_at > ? AND body IS NOT NULL AND expires_at > ? AND available_at <= ? AND (status IN ? OR (status = ? AND lease_until <= ?))", now, now, now, []string{"pending", "retry", "paused", "budget_paused"}, "running", now).
			Where("is_test = ? OR policy_id IN (?)", true, tx.Model(&PolicyRow{}).Select("id").Where("enabled = ?", true))
		if !config.Enabled {
			q = q.Where("is_test = ?", true)
		}
		if err := q.Order("id").First(&task).Error; err != nil {
			return err
		}
		var policy Policy
		if err := common.UnmarshalJsonStr(task.Snapshot, &policy); err != nil {
			return err
		}
		if task.Attempts > policy.Retries {
			task.Status = "failed"
			return tx.Model(&task).Updates(map[string]any{"status": "failed", "error": "retry_limit", "lease": "", "lease_until": 0}).Error
		}
		day := time.Now().UTC().Format("2006-01-02")
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&Budget{Day: day}).Error; err != nil {
			return err
		}
		var budget Budget
		if err := tx.First(&budget, "day = ?", day).Error; err != nil {
			return err
		}
		// Reserve a conservative byte-based input bound plus the enforced output
		// cap. Unknown/crashed calls retain their reservation for the UTC day.
		reservation := int64(len(task.Body) + len(policy.Rules) + len(SystemPrompt) + 4096)
		if budget.Calls >= config.DailyCalls || budget.Tokens+budget.ReservedTokens+reservation > config.DailyTokens {
			task.Status = "budget_paused"
			return tx.Model(&task).Updates(map[string]any{"status": task.Status, "available_at": time.Now().UTC().Truncate(24 * time.Hour).Add(24 * time.Hour).Unix()}).Error
		}
		if err := tx.Model(&budget).Updates(map[string]any{"calls": gorm.Expr("calls + 1"), "reserved_tokens": gorm.Expr("reserved_tokens + ?", reservation)}).Error; err != nil {
			return err
		}
		task.Lease = common.NewRequestId()
		task.LeaseDay = day
		task.TokenReservation = reservation
		task.LeaseUntil = now + int64(policy.TimeoutSeconds) + 30
		task.Attempts++
		task.Status = "running"
		return tx.Model(&task).Updates(map[string]any{"status": task.Status, "lease": task.Lease, "lease_day": day, "token_reservation": reservation, "lease_until": task.LeaseUntil, "attempts": task.Attempts}).Error
	})
	if err != nil {
		return nil, err
	}
	if task.Status != "running" || task.Lease == "" {
		return nil, gorm.ErrRecordNotFound
	}
	return &task, nil
}

func (s *Store) Complete(ctx context.Context, t Task, result *Result, call CallResult, target Target, callErr error) error {
	leaseLost := false
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Use the same lock order as scheduling and administrative corrections.
		var row ConfigRow
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&row, 1).Error; err != nil {
			return err
		}
		var live Task
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&live, t.ID).Error; err != nil {
			return err
		}
		leaseLost = live.Lease != t.Lease || live.Status != "running" || live.LeaseUntil <= unixNow()
		// Account every completed attempt once, even if its result lost the lease.
		// The fencing below still prevents stale results from changing verdicts.
		var accounted int64
		if err := tx.Model(&History{}).Where("lease = ?", t.Lease).Count(&accounted).Error; err != nil {
			return err
		}
		if accounted > 0 {
			return nil
		}
		var p Policy
		if err := common.UnmarshalJsonStr(t.Snapshot, &p); err != nil {
			return err
		}
		updates := map[string]any{"lease": "", "lease_until": 0, "input_tokens": live.InputTokens + call.InputTokens, "output_tokens": live.OutputTokens + call.OutputTokens}
		h := History{TaskID: t.ID, CreatedAt: unixNow(), Kind: "machine", ChannelID: target.ChannelID, Model: call.Model, Fingerprint: call.Fingerprint, InputTokens: call.InputTokens, OutputTokens: call.OutputTokens, UnknownUsage: !call.UsageKnown, Lease: &t.Lease}
		unknown := int64(0)
		if !call.UsageKnown {
			unknown = 1
		}
		updates["unknown_usage"] = live.UnknownUsage + unknown
		day := t.LeaseDay
		if day == "" {
			day = time.Now().UTC().Format("2006-01-02")
		}
		if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "day"}}, DoUpdates: clause.Assignments(map[string]any{"tokens": gorm.Expr("request_moderation_budgets.tokens + ?", call.InputTokens+call.OutputTokens), "unknown_calls": gorm.Expr("request_moderation_budgets.unknown_calls + ?", unknown)})}).Create(&Budget{Day: day, Tokens: call.InputTokens + call.OutputTokens, UnknownCalls: unknown}).Error; err != nil {
			return err
		}
		if call.UsageKnown {
			if err := tx.Model(&Budget{}).Where("day = ?", day).UpdateColumn("reserved_tokens", gorm.Expr("GREATEST(0, reserved_tokens - ?)", t.TokenReservation)).Error; err != nil {
				return err
			}
		}
		if leaseLost {
			h.Kind = "stale_attempt"
			if err := tx.Model(&live).Updates(map[string]any{"input_tokens": live.InputTokens + call.InputTokens, "output_tokens": live.OutputTokens + call.OutputTokens, "unknown_usage": live.UnknownUsage + unknown}).Error; err != nil {
				return err
			}
			return tx.Create(&h).Error
		}
		if callErr != nil {
			updates["status"] = "failed"
			updates["error"] = callErr.Error()
			if t.Attempts <= p.Retries {
				updates["status"] = "retry"
				updates["available_at"] = unixNow() + int64(1<<min(t.Attempts, 6))*5
			}
			h.Kind = "failure"
		} else {
			updates["status"] = "completed"
			updates["error"] = ""
			updates["verdict"] = result.Verdict
			updates["severity"] = result.Severity
			updates["categories"] = strings.Join(result.Categories, ",")
			updates["needs_review"] = live.HumanVerdict == "" && (result.NeedsReview || result.Verdict != "safe" || !live.Complete)
			h.Verdict = result.Verdict
			var err error
			h.Payload, err = s.seal(result)
			if err != nil {
				return err
			}
			if result.Verdict == "violation" {
				var config Config
				if err := common.UnmarshalJsonStr(row.Payload, &config); err != nil {
					return err
				}
				updates["body_expires_at"] = unixNow() + int64(config.EvidenceHours)*3600
			}
		}
		var config Config
		if err := common.UnmarshalJsonStr(row.Payload, &config); err != nil {
			return err
		}
		if live.BodyExpiresAt <= unixNow() || row.StoredBytes+int64(len(h.Payload)) > config.MaxStoredBytes {
			h.Payload = nil
			updates["complete"] = false
			updates["needs_review"] = true
			updates["error"] = "review_evidence_not_retained"
			live.Complete = false
		}
		if len(h.Payload) > 0 {
			if err := tx.Model(&row).UpdateColumn("stored_bytes", gorm.Expr("stored_bytes + ?", len(h.Payload))).Error; err != nil {
				return err
			}
		}
		if err := tx.Model(&live).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.Create(&h).Error; err != nil {
			return err
		}
		if result != nil && callErr == nil && result.Verdict == "violation" && live.Complete && (live.HumanVerdict == "" || live.HumanVerdict == "violation") && !live.IsTest && p.AutoRestrict && severity(result.Severity) >= severity(p.MinSeverity) {
			return s.automate(tx, live, p)
		}
		return nil
	})
	if err == nil && leaseLost {
		return errors.New("moderation worker lease lost")
	}
	return err
}

// PauseClaim refunds an unused call reservation when monitoring is disabled.
func (s *Store) PauseClaim(ctx context.Context, t Task) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var lock ConfigRow
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&lock, 1).Error; err != nil {
			return err
		}
		changed := tx.Model(&Task{}).Where("id = ? AND lease = ? AND status = ?", t.ID, t.Lease, "running").Updates(map[string]any{"status": "paused", "lease": "", "lease_until": 0, "attempts": max(0, t.Attempts-1)})
		if changed.Error != nil {
			return changed.Error
		}
		if changed.RowsAffected == 0 {
			return nil
		}
		return tx.Model(&Budget{}).Where("day = ? AND calls > 0", t.LeaseDay).Updates(map[string]any{"calls": gorm.Expr("calls - 1"), "reserved_tokens": gorm.Expr("GREATEST(0, reserved_tokens - ?)", t.TokenReservation)}).Error
	})
}

func (s *Store) automate(tx *gorm.DB, t Task, p Policy) error {
	subjectID := t.UserID
	column := "user_id"
	if p.Subject == "token" {
		subjectID = t.TokenID
		column = "token_id"
	}
	if subjectID <= 0 {
		return nil
	}
	var policies PolicyRow
	if err := tx.First(&policies, p.ID).Error; err != nil {
		return err
	}
	var current Policy
	if err := common.UnmarshalJsonStr(policies.Payload, &current); err != nil {
		return err
	}
	if !current.Enabled || !current.AutoRestrict || current.Version != p.Version {
		return nil
	}
	var restrictions []Restriction
	if err := tx.Where("subject = ? AND subject_id = ? AND channel_id = ?", p.Subject, subjectID, t.ChannelID).Find(&restrictions).Error; err != nil {
		return err
	}
	var watermark int64
	for _, r := range restrictions {
		if r.ReleasedAt > 0 {
			watermark = max(watermark, r.Watermark)
		}
		if r.ReleasedAt == 0 && (r.ExpiresAt == 0 || r.ExpiresAt > unixNow()) {
			return nil
		}
	}
	if t.CreatedAt <= watermark {
		return nil
	}
	var candidates []Task
	if err := tx.Where(column+" = ? AND channel_id = ? AND policy_id = ? AND created_at > ? AND complete = ? AND is_test = ? AND verdict = ? AND human_verdict IN ?", subjectID, t.ChannelID, p.ID, max(watermark, unixNow()-int64(p.WindowHours)*3600), true, false, "violation", []string{"", "violation"}).Order("id DESC").Limit(10000).Find(&candidates).Error; err != nil {
		return err
	}
	seen := map[string]bool{}
	ids := make([]string, 0, p.ViolationCount)
	for _, candidate := range candidates {
		if severity(candidate.Severity) >= severity(p.MinSeverity) && !seen[candidate.RequestID] {
			seen[candidate.RequestID] = true
			ids = append(ids, strconv.FormatInt(candidate.ID, 10))
		}
		if len(ids) >= p.ViolationCount {
			break
		}
	}
	if len(ids) < p.ViolationCount {
		return nil
	}
	return tx.Create(&Restriction{Subject: p.Subject, SubjectID: subjectID, ChannelID: t.ChannelID, Reason: "Repeated verified violations", CreatedAt: unixNow(), ExpiresAt: unixNow() + int64(p.RestrictionHours)*3600, SourceTaskID: t.ID, Automatic: true, EvidenceIDs: strings.Join(ids, ",")}).Error
}

func (s *Store) HumanReview(ctx context.Context, id int64, actor int, verdict, note string) error {
	if !slices.Contains([]string{"safe", "violation", "uncertain"}, verdict) || len(note) > 2000 {
		return errors.New("invalid moderation review")
	}
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var lock ConfigRow
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&lock, 1).Error; err != nil {
			return err
		}
		var task Task
		if err := tx.First(&task, id).Error; err != nil {
			return err
		}
		if err := tx.Model(&task).Updates(map[string]any{"human_verdict": verdict, "needs_review": false}).Error; err != nil {
			return err
		}
		payload, err := s.seal(map[string]string{"note": note})
		if err != nil {
			return err
		}
		var config Config
		if err := common.UnmarshalJsonStr(lock.Payload, &config); err != nil {
			return err
		}
		if task.BodyExpiresAt <= unixNow() {
			payload = nil
		}
		if lock.StoredBytes+int64(len(payload)) > config.MaxStoredBytes {
			return ErrStorageCapacity
		}
		if err := tx.Model(&lock).UpdateColumn("stored_bytes", gorm.Expr("stored_bytes + ?", len(payload))).Error; err != nil {
			return err
		}
		if err = tx.Create(&History{TaskID: id, CreatedAt: unixNow(), ActorID: actor, Kind: "human", Verdict: verdict, Payload: payload}).Error; err != nil {
			return err
		}
		if verdict != "violation" {
			var restrictions []Restriction
			if err := tx.Where("automatic = ? AND released_at = 0", true).Find(&restrictions).Error; err != nil {
				return err
			}
			for _, r := range restrictions {
				if slices.Contains(strings.Split(r.EvidenceIDs, ","), strconv.FormatInt(id, 10)) {
					if err := tx.Model(&r).Updates(map[string]any{"released_at": unixNow(), "watermark": unixNow(), "actor_id": actor}).Error; err != nil {
						return err
					}
				}
			}
		}
		return nil
	})
}

func (s *Store) Requeue(ctx context.Context, id int64, actor int) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var task Task
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&task, id).Error; err != nil {
			return err
		}
		if len(task.Body) == 0 || task.BodyExpiresAt <= unixNow() {
			return errors.New("moderation body has expired")
		}
		if task.Status == "running" {
			return errors.New("moderation task is running")
		}
		if task.Generation >= 20 {
			return errors.New("moderation_requeue_limit")
		}
		config, err := s.Config(ctx)
		if err != nil {
			return err
		}
		if err = tx.Model(&task).Updates(map[string]any{"status": "pending", "attempts": 0, "generation": task.Generation + 1, "available_at": unixNow(), "expires_at": unixNow() + int64(config.PendingHours)*3600, "error": ""}).Error; err != nil {
			return err
		}
		return tx.Create(&History{TaskID: id, CreatedAt: unixNow(), ActorID: actor, Kind: "requeue"}).Error
	})
}

func (s *Store) SaveRestriction(ctx context.Context, r Restriction, release bool) error {
	if !slices.Contains([]string{"user", "token"}, r.Subject) || r.SubjectID <= 0 || r.ChannelID <= 0 || strings.TrimSpace(r.Reason) == "" || len(r.Reason) > 500 || (r.ExpiresAt != 0 && (r.ExpiresAt <= unixNow() || r.ExpiresAt > unixNow()+10*365*86400)) {
		return errors.New("invalid moderation restriction")
	}
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var lock ConfigRow
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&lock, 1).Error; err != nil {
			return err
		}
		if r.ID == 0 && r.SourceTaskID > 0 {
			var source Task
			if err := tx.First(&source, r.SourceTaskID).Error; err != nil {
				return err
			}
			subjectID := source.UserID
			if r.Subject == "token" {
				subjectID = source.TokenID
			}
			if source.IsTest || subjectID != r.SubjectID || source.ChannelID != r.ChannelID {
				return errors.New("invalid_moderation_restriction_source")
			}
		}
		if r.ID != 0 {
			var current Restriction
			if err := tx.First(&current, r.ID).Error; err != nil {
				return err
			}
			updates := map[string]any{"expires_at": r.ExpiresAt, "reason": r.Reason, "actor_id": r.ActorID}
			if release {
				updates["released_at"] = unixNow()
				updates["watermark"] = unixNow()
			}
			if err := tx.Model(&current).Updates(updates).Error; err != nil {
				return err
			}
		} else {
			r.CreatedAt = unixNow()
			r.Automatic = false
			r.ReleasedAt = 0
			r.EvidenceIDs = ""
			r.Watermark = 0
			if err := tx.Create(&r).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) Cleanup(ctx context.Context, c Config) error {
	now := unixNow()
	db := s.DB.WithContext(ctx)
	var expiredIDs []int64
	if err := db.Model(&Task{}).Where("(expires_at <= ? OR body_expires_at <= ?) AND status IN ?", now, now, []string{"pending", "retry", "paused", "budget_paused", "running"}).Limit(200).Pluck("id", &expiredIDs).Error; err != nil {
		return err
	}
	if len(expiredIDs) > 0 {
		if err := db.Model(&Task{}).Where("id IN ? AND (expires_at <= ? OR body_expires_at <= ?)", expiredIDs, now, now).Updates(map[string]any{"status": "expired", "lease": "", "lease_until": 0}).Error; err != nil {
			return err
		}
	}
	var ids []int64
	if err := db.Model(&Task{}).Where("body_expires_at <= ? AND body IS NOT NULL", now).Limit(200).Pluck("id", &ids).Error; err != nil {
		return err
	}
	if len(ids) > 0 {
		if err := db.Transaction(func(tx *gorm.DB) error {
			var lock ConfigRow
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&lock, 1).Error; err != nil {
				return err
			}
			var eligible []int64
			if err := tx.Model(&Task{}).Where("id IN ? AND body_expires_at <= ?", ids, now).Pluck("id", &eligible).Error; err != nil {
				return err
			}
			if len(eligible) == 0 {
				return nil
			}
			ids = eligible
			var size int64
			if err := tx.Model(&Task{}).Where("id IN ?", ids).Select("COALESCE(SUM(octet_length(body)),0)").Scan(&size).Error; err != nil {
				return err
			}
			var historySize int64
			if err := tx.Model(&History{}).Where("task_id IN ?", ids).Select("COALESCE(SUM(octet_length(payload)),0)").Scan(&historySize).Error; err != nil {
				return err
			}
			size += historySize
			if err := tx.Model(&Task{}).Where("id IN ?", ids).Update("body", nil).Error; err != nil {
				return err
			}
			if err := tx.Model(&History{}).Where("task_id IN ?", ids).Update("payload", nil).Error; err != nil {
				return err
			}
			return tx.Model(&lock).UpdateColumn("stored_bytes", max(0, lock.StoredBytes-size)).Error
		}); err != nil {
			return err
		}
	}
	ids = nil
	if err := db.Model(&Task{}).Where("created_at < ? AND body IS NULL AND id NOT IN (?)", now-int64(c.RecordDays)*86400, db.Model(&Restriction{}).Select("source_task_id").Where("source_task_id > 0")).Where("NOT EXISTS (SELECT 1 FROM request_moderation_restrictions r WHERE request_moderation_tasks.id::text = ANY(string_to_array(r.evidence_ids, ',')))").Limit(200).Pluck("id", &ids).Error; err != nil {
		return err
	}
	if len(ids) > 0 {
		if err := db.Where("task_id IN ?", ids).Delete(&History{}).Error; err != nil {
			return err
		}
		if err := db.Where("id IN ?", ids).Delete(&Task{}).Error; err != nil {
			return err
		}
	}
	var attempts []int64
	if err := db.Model(&Attempt{}).Where("selected_at < ?", now-int64(c.RecordDays)*86400).Limit(1000).Pluck("id", &attempts).Error; err != nil {
		return err
	}
	if len(attempts) > 0 {
		return db.Where("id IN ?", attempts).Delete(&Attempt{}).Error
	}
	return nil
}
