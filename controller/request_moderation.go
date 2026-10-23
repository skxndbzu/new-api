package controller

import (
	"context"
	"errors"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	moderation "github.com/QuantumNous/new-api/pkg/requestmoderation"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func ModerationJSONBody(c *gin.Context) {
	media, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || media != "application/json" {
		c.AbortWithStatus(http.StatusUnsupportedMediaType)
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<20)
	c.Next()
}
func moderationEngine(c *gin.Context) (*moderation.Engine, context.Context, context.CancelFunc) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	e := moderation.Active()
	if e == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "Request moderation is unavailable", "message_key": "Request moderation is unavailable"})
	}
	return e, ctx, cancel
}
func moderationReply(c *gin.Context, data any, err error) {
	if err == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
		return
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Record not found", "message_key": "Record not found"})
		return
	}
	// SQL/driver errors must not expose DSNs, encrypted payloads or bind values.
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		err = errors.New("moderation_database_timeout")
	}
	message := map[string]string{
		"review channel is disabled":                    "Review channel is disabled",
		"review channel does not exist":                 "Review channel does not exist",
		"review model is not configured on the channel": "Review model is not configured on the channel",
		"review_channel_override_conflict":              "Review channel overrides conflict with the moderation prompt",
		"moderation_storage_capacity":                   "Moderation storage capacity reached",
		"moderation body has expired":                   "Moderation content has expired.",
	}[err.Error()]
	if message == "" {
		message = "Request moderation operation failed"
	}
	c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": message, "message_key": message, "error_code": moderationErrorCode(err)})
}
func moderationErrorCode(err error) string {
	// Return domain validation details only; driver errors have structured
	// implementations rather than errors.errorString. No raw SQL is returned.
	if _, ok := err.(interface{ SQLState() string }); ok {
		return "moderation_database_error"
	}
	text := err.Error()
	if len(text) > 100 || !strings.Contains(text, "_") {
		return "moderation_operation_failed"
	}
	for _, r := range text {
		if !(r == '_' || r >= 'a' && r <= 'z' || r >= '0' && r <= '9') {
			return "moderation_operation_failed"
		}
	}
	return text
}
func moderationBind(c *gin.Context, v any) bool {
	if err := common.DecodeJson(c.Request.Body, v); err != nil {
		moderationReply(c, nil, errors.New("invalid_moderation_request"))
		return false
	}
	return true
}
func moderationID(c *gin.Context) int64 { id, _ := strconv.ParseInt(c.Param("id"), 10, 64); return id }
func moderationQueryInt(c *gin.Context, key string, def int) int {
	raw := c.Query(key)
	if raw == "" {
		return def
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 0 {
		return def
	}
	return min(value, 2147483647)
}

func ModerationOverview(c *gin.Context) {
	e := moderation.Active()
	if e == nil {
		moderationReply(c, gin.H{"available": false, "healthy": false}, nil)
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	data, err := e.Overview(ctx)
	moderationReply(c, data, err)
}
func ModerationSettings(c *gin.Context) {
	e, ctx, cancel := moderationEngine(c)
	defer cancel()
	if e == nil {
		return
	}
	policies, err := e.Store.Policies(ctx)
	moderationReply(c, gin.H{"config": e.Config(), "policies": policies, "default_policy": moderation.DefaultPolicy()}, err)
}
func ModerationSaveSettings(c *gin.Context) {
	e, ctx, cancel := moderationEngine(c)
	defer cancel()
	if e == nil {
		return
	}
	var config moderation.Config
	if !moderationBind(c, &config) {
		return
	}
	err := e.Store.SaveConfig(ctx, config)
	if err == nil {
		err = e.Refresh(ctx)
	}
	moderationReply(c, config, err)
}
func ModerationSavePolicy(c *gin.Context) {
	e, ctx, cancel := moderationEngine(c)
	defer cancel()
	if e == nil {
		return
	}
	var policy moderation.Policy
	if !moderationBind(c, &policy) {
		return
	}
	if policy.AutoRestrict && !authz.Can(c.GetInt("id"), c.GetInt("role"), authz.RequestModerationRestrict) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	// Validate business channels against authoritative IDs, without exposing
	// their credentials through policy or channel-picker responses.
	var count int64
	err := model.DB.WithContext(ctx).Model(&model.Channel{}).Where("id IN ?", policy.Channels).Count(&count).Error
	if (policy.Enabled || policy.ID == 0) && (err != nil || count != int64(len(policy.Channels))) {
		moderationReply(c, nil, errors.New("invalid_or_duplicate_business_channels"))
		return
	}
	saved, err := e.Store.SavePolicy(ctx, policy, validateModerationTarget)
	if err == nil {
		err = e.Refresh(ctx)
	}
	moderationReply(c, saved, err)
}
func ModerationChannels(c *gin.Context) {
	_, ctx, cancel := moderationEngine(c)
	defer cancel()
	if moderation.Active() == nil {
		return
	}
	type option struct {
		ID              int    `json:"id"`
		Name            string `json:"name"`
		Models          string `json:"models"`
		Type            int    `json:"type"`
		Status          int    `json:"status"`
		ReviewSupported bool   `json:"review_supported"`
	}
	var rows []option
	err := model.DB.WithContext(ctx).Model(&model.Channel{}).Select("id,name,models,type,status").Order("id").Limit(10001).Scan(&rows).Error
	if len(rows) > 10000 {
		moderationReply(c, nil, errors.New("channel_picker_capacity_exceeded"))
		return
	}
	for i := range rows {
		rows[i].ReviewSupported = moderationChannelAllowed(rows[i].Type)
	}
	moderationReply(c, rows, err)
}
func ModerationRecords(c *gin.Context) {
	e, ctx, cancel := moderationEngine(c)
	defer cancel()
	if e == nil {
		return
	}
	data, err := e.Store.Tasks(ctx, moderation.Filter{Page: moderationQueryInt(c, "page", 1), Size: moderationQueryInt(c, "size", 20), UserID: moderationQueryInt(c, "user_id", 0), TokenID: moderationQueryInt(c, "token_id", 0), ChannelID: moderationQueryInt(c, "channel_id", 0), PolicyID: int64(moderationQueryInt(c, "policy_id", 0)), Status: c.Query("status"), Category: c.Query("category"), Start: int64(moderationQueryInt(c, "start", 0)), End: int64(moderationQueryInt(c, "end", 0)), ReviewOnly: c.DefaultQuery("review_only", "true") == "true"})
	moderationReply(c, data, err)
}
func ModerationDetail(c *gin.Context) {
	e, ctx, cancel := moderationEngine(c)
	defer cancel()
	if e == nil {
		return
	}
	data, err := e.Store.Detail(ctx, moderationID(c))
	moderationReply(c, data, err)
}
func ModerationRestrictions(c *gin.Context) {
	e, ctx, cancel := moderationEngine(c)
	defer cancel()
	if e == nil {
		return
	}
	data, err := e.Store.Restrictions(ctx, moderationQueryInt(c, "page", 1), moderationQueryInt(c, "size", 20), c.Query("state"))
	moderationReply(c, data, err)
}
func ModerationReview(c *gin.Context) {
	e, ctx, cancel := moderationEngine(c)
	defer cancel()
	if e == nil {
		return
	}
	var input struct {
		Verdict string `json:"verdict"`
		Note    string `json:"note"`
	}
	if !moderationBind(c, &input) {
		return
	}
	err := e.Store.HumanReview(ctx, moderationID(c), c.GetInt("id"), input.Verdict, input.Note)
	if err == nil {
		err = e.Refresh(ctx)
	}
	moderationReply(c, nil, err)
}
func ModerationRequeue(c *gin.Context) {
	e, ctx, cancel := moderationEngine(c)
	defer cancel()
	if e == nil {
		return
	}
	moderationReply(c, nil, e.Store.Requeue(ctx, moderationID(c), c.GetInt("id")))
}
func ModerationSaveRestriction(c *gin.Context) {
	e, ctx, cancel := moderationEngine(c)
	defer cancel()
	if e == nil {
		return
	}
	var input struct {
		moderation.Restriction
		Release bool `json:"release"`
	}
	if !moderationBind(c, &input) {
		return
	}
	input.ActorID = c.GetInt("id")
	err := e.Store.SaveRestriction(ctx, input.Restriction, input.Release)
	if err == nil {
		err = e.Refresh(ctx)
	}
	moderationReply(c, nil, err)
}
func ModerationTest(c *gin.Context) {
	e, ctx, cancel := moderationEngine(c)
	defer cancel()
	if e == nil {
		return
	}
	var input struct {
		Policy    moderation.Policy `json:"policy"`
		Body      string            `json:"body"`
		ModelCall bool              `json:"model_call"`
	}
	if !moderationBind(c, &input) {
		return
	}
	content, selection, task, err := e.Test(ctx, input.Policy, []byte(input.Body), input.ModelCall)
	moderationReply(c, gin.H{"content": content, "selection": selection, "task": task}, err)
}
