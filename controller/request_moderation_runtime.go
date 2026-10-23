package controller

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"os"
	"slices"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	moderation "github.com/QuantumNous/new-api/pkg/requestmoderation"
	"github.com/QuantumNous/new-api/relay"
	"github.com/gin-gonic/gin"
)

var moderationLifecycle struct {
	sync.Mutex
	cancel context.CancelFunc
	done   chan struct{}
}

// StartRequestModeration is optional and never delays gateway startup. An
// unavailable dedicated database is retried without affecting main resources.
func StartRequestModeration() {
	dsn := os.Getenv("REQUEST_MODERATION_DSN")
	if dsn == "" {
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	moderationLifecycle.Lock()
	moderationLifecycle.cancel = cancel
	moderationLifecycle.done = make(chan struct{})
	done := moderationLifecycle.done
	moderationLifecycle.Unlock()
	go func() {
		defer close(done)
		key, err := base64.StdEncoding.DecodeString(os.Getenv("REQUEST_MODERATION_ENCRYPTION_KEY"))
		if err != nil || len(key) != 32 {
			common.SysError(common.LogText("request moderation encryption key is invalid"))
			return
		}
		for {
			store, err := moderation.Open(dsn, key)
			if err == nil {
				engine := moderation.NewEngine(store, callModerationChannel, validateModerationTarget)
				if err = engine.Start(); err == nil {
					moderation.SetActive(engine)
					<-ctx.Done()
					shutdown, stop := context.WithTimeout(context.Background(), 8*time.Second)
					engine.Stop(shutdown)
					stop()
					moderation.SetActive(nil)
					sqlDB, _ := store.DB.DB()
					sqlDB.Close()
					return
				}
				sqlDB, _ := store.DB.DB()
				sqlDB.Close()
			}
			common.SysError(common.LogText("request moderation unavailable; business relay remains available"))
			select {
			case <-ctx.Done():
				return
			case <-time.After(30 * time.Second):
			}
		}
	}()
}
func StopRequestModeration() {
	moderationLifecycle.Lock()
	cancel, done := moderationLifecycle.cancel, moderationLifecycle.done
	moderationLifecycle.Unlock()
	if cancel == nil {
		return
	}
	cancel()
	select {
	case <-done:
	case <-time.After(10 * time.Second):
	}
}

func moderationChannelAllowed(channelType int) bool {
	return slices.Contains([]int{constant.ChannelTypeOpenAI, constant.ChannelTypeDeepSeek, constant.ChannelTypeZhipu_v4, constant.ChannelTypeNewAPI}, channelType)
}
func validateModerationTarget(ctx context.Context, target moderation.Target) error {
	if target.ChannelID <= 0 || target.Model == "" || len(target.Model) > 256 || target.Protocol != "chat" {
		return errors.New("invalid review channel, model or protocol")
	}
	var channel model.Channel
	if err := model.DB.WithContext(ctx).First(&channel, target.ChannelID).Error; err != nil {
		return errors.New("review channel does not exist")
	}
	if channel.Status != common.ChannelStatusEnabled {
		return errors.New("review channel is disabled")
	}
	if !moderationChannelAllowed(channel.Type) {
		return errors.New("review channel must support OpenAI-compatible chat completions")
	}
	if !slices.Contains(channel.GetModels(), target.Model) {
		return errors.New("review model is not configured on the channel")
	}
	return nil
}
func callModerationChannel(ctx context.Context, target moderation.Target, system, input string) (moderation.CallResult, error) {
	result := moderation.CallResult{}
	if err := validateModerationTarget(ctx, target); err != nil {
		return result, err
	}
	var channel model.Channel
	if err := model.DB.WithContext(ctx).First(&channel, target.ChannelID).Error; err != nil {
		return result, errors.New("review_channel_unavailable")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "/v1/chat/completions", http.NoBody)
	if err != nil {
		return result, err
	}
	request.Header.Set("Content-Type", "application/json")
	c := &gin.Context{Request: request}
	c.Set(common.RequestIdKey, common.NewRequestId())
	if apiErr := middleware.SetupContextForSelectedChannel(c, &channel, target.Model); apiErr != nil {
		return result, errors.New("review_channel_credentials_unavailable")
	}
	return relay.CallModerationText(c, target.Model, system, input)
}
