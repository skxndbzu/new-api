package requestmoderation

import (
	"context"
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type Filter struct {
	Page       int
	Size       int
	UserID     int
	TokenID    int
	ChannelID  int
	PolicyID   int64
	Status     string
	Category   string
	Start      int64
	End        int64
	ReviewOnly bool
}
type Page[T any] struct {
	Items []T   `json:"items"`
	Total int64 `json:"total"`
	Page  int   `json:"page"`
	Size  int   `json:"size"`
}

func (s *Store) Tasks(ctx context.Context, f Filter) (Page[Task], error) {
	page := Page[Task]{Items: []Task{}, Page: max(1, f.Page), Size: min(100, max(1, f.Size))}
	q := s.DB.WithContext(ctx).Model(&Task{})
	for col, id := range map[string]int64{"user_id": int64(f.UserID), "token_id": int64(f.TokenID), "channel_id": int64(f.ChannelID), "policy_id": f.PolicyID} {
		if id > 0 {
			q = q.Where(col+" = ?", id)
		}
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.Category != "" {
		q = q.Where("categories LIKE ?", "%"+f.Category+"%")
	}
	if f.ReviewOnly {
		q = q.Where("needs_review = ?", true)
	}
	if f.Start > 0 {
		q = q.Where("created_at >= ?", f.Start)
	}
	if f.End > 0 {
		q = q.Where("created_at <= ?", f.End)
	}
	if err := q.Count(&page.Total).Error; err != nil {
		return page, err
	}
	err := q.Omit("body", "snapshot", "lease").Order("id DESC").Offset((page.Page - 1) * page.Size).Limit(page.Size).Find(&page.Items).Error
	return page, err
}

type HistoryView struct {
	History
	Detail any `json:"detail,omitempty"`
}
type Detail struct {
	Task     Task          `json:"task"`
	Content  *Content      `json:"content"`
	Policy   Policy        `json:"policy"`
	History  []HistoryView `json:"history"`
	Attempts []Attempt     `json:"channel_attempts"`
}

func (s *Store) Detail(ctx context.Context, id int64) (Detail, error) {
	result := Detail{History: []HistoryView{}, Attempts: []Attempt{}}
	if err := s.DB.WithContext(ctx).First(&result.Task, id).Error; err != nil {
		return result, err
	}
	if err := common.UnmarshalJsonStr(result.Task.Snapshot, &result.Policy); err != nil {
		return result, err
	}
	if len(result.Task.Body) > 0 && result.Task.BodyExpiresAt > unixNow() {
		var c Content
		if err := s.open(result.Task.Body, &c); err != nil {
			return result, err
		}
		result.Content = &c
	}
	var history []History
	if err := s.DB.WithContext(ctx).Where("task_id = ?", id).Order("id DESC").Limit(100).Find(&history).Error; err != nil {
		return result, err
	}
	for _, h := range history {
		view := HistoryView{History: h}
		if len(h.Payload) > 0 && result.Task.BodyExpiresAt > unixNow() {
			if err := s.open(h.Payload, &view.Detail); err != nil {
				return result, err
			}
		}
		result.History = append(result.History, view)
	}
	err := s.DB.WithContext(ctx).Where("request_id = ?", result.Task.RequestID).Order("number").Limit(100).Find(&result.Attempts).Error
	return result, err
}
func (s *Store) Restrictions(ctx context.Context, page, size int, state string) (Page[Restriction], error) {
	result := Page[Restriction]{Items: []Restriction{}, Page: max(1, page), Size: min(100, max(1, size))}
	q := s.DB.WithContext(ctx).Model(&Restriction{})
	switch state {
	case "active":
		q = q.Where("released_at = 0 AND (expires_at = 0 OR expires_at > ?)", unixNow())
	case "released":
		q = q.Where("released_at > 0")
	case "expired":
		q = q.Where("released_at = 0 AND expires_at > 0 AND expires_at <= ?", unixNow())
	}
	if err := q.Count(&result.Total).Error; err != nil {
		return result, err
	}
	err := q.Order("id DESC").Offset((result.Page - 1) * result.Size).Limit(result.Size).Find(&result.Items).Error
	return result, err
}

type Overview struct {
	Available     bool             `json:"available"`
	Healthy       bool             `json:"healthy"`
	Config        Config           `json:"config"`
	QueueTasks    int              `json:"queue_tasks"`
	QueueBytes    int64            `json:"queue_bytes"`
	Counters      []Counter        `json:"counters"`
	LocalCounters map[string]int64 `json:"local_counters"`
	Statuses      []Distribution   `json:"statuses"`
	Verdicts      []Distribution   `json:"verdicts"`
	Budget        Budget           `json:"budget"`
	OldestPending int64            `json:"oldest_pending"`
	CostUSD       *float64         `json:"cost_usd"`
	CacheSeconds  int              `json:"cache_seconds"`
}
type Distribution struct {
	Name  string `json:"name"`
	Count int64  `json:"count"`
}

func (e *Engine) Overview(ctx context.Context) (Overview, error) {
	result := Overview{Available: true, Healthy: e.Healthy(), Config: e.Config(), LocalCounters: e.Counters(), CacheSeconds: 5, Counters: []Counter{}, Statuses: []Distribution{}, Verdicts: []Distribution{}}
	result.QueueTasks, result.QueueBytes = e.QueueUsage()
	db := e.Store.DB.WithContext(ctx)
	if err := db.Where("day >= ?", time.Now().UTC().AddDate(0, 0, -7).Format("2006-01-02")).Find(&result.Counters).Error; err != nil {
		return result, err
	}
	if err := db.Model(&Task{}).Select("status AS name, COUNT(*) AS count").Group("status").Find(&result.Statuses).Error; err != nil {
		return result, err
	}
	if err := db.Model(&Task{}).Select("verdict AS name, COUNT(*) AS count").Where("verdict <> ''").Group("verdict").Find(&result.Verdicts).Error; err != nil {
		return result, err
	}
	var oldest Task
	if err := db.Select("created_at").Where("status IN ?", []string{"pending", "retry", "paused", "budget_paused"}).Order("created_at").Limit(1).Find(&oldest).Error; err != nil {
		return result, err
	}
	result.OldestPending = oldest.CreatedAt
	err := db.Where("day = ?", time.Now().UTC().Format("2006-01-02")).Limit(1).Find(&result.Budget).Error
	return result, err
}
func (e *Engine) Test(ctx context.Context, p Policy, body []byte, modelCall bool) (Content, string, *Task, error) {
	compiled, err := compilePolicy(p)
	if err != nil {
		return Content{}, "", nil, err
	}
	config := e.Config()
	if int64(len(body)) > config.MaxBodyBytes {
		return Content{}, "", nil, errors.New("moderation test input is too large")
	}
	content, err := Extract(body, config.ScanBytes)
	if err != nil {
		return content, "", nil, err
	}
	requestID := common.NewRequestId()
	content, selection := screen(compiled, content, requestID, config.ReviewBytes)
	if !modelCall {
		return content, selection, nil, nil
	}
	if err = e.ValidateTarget(ctx, p.Primary); err != nil {
		return content, selection, nil, err
	}
	if p.Fallback != nil {
		if err = e.ValidateTarget(ctx, *p.Fallback); err != nil {
			return content, selection, nil, err
		}
	}
	// A model test explicitly requests review even when sampling skips it.
	if selection == "skipped_not_sampled" {
		compiled.SamplePercent = 100
		content, selection = screen(compiled, content, requestID, config.ReviewBytes)
	}
	task := &Task{RequestID: requestID, PolicyID: p.ID, Version: p.Version, IsTest: true, Selection: "test"}
	err = e.Store.Persist(ctx, task, content, p, config)
	return content, selection, task, err
}
