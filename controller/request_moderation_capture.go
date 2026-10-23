package controller

import (
	"errors"
	"net/http"
	"slices"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	moderation "github.com/QuantumNous/new-api/pkg/requestmoderation"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func newModerationCapture(c *gin.Context) *moderation.Capture {
	engine := moderation.Active()
	if engine == nil || !engine.Config().Enabled || !moderation.SupportedPath(c.Request.URL.Path) {
		return nil
	}
	return engine.NewCapture()
}

// A restriction may arrive between distribution and the first actual send.
// Re-select through the normal pin/affinity rules before rejecting the request.
func moderationReselect(c *gin.Context, info *relaycommon.RelayInfo, retry *service.RetryParam, denied *types.NewAPIError) (*model.Channel, *types.NewAPIError) {
	channel, group, selectionErr := service.SelectChannelForRequest(c, info.OriginModelName, retry)
	if selectionErr != nil || channel == nil {
		return nil, denied
	}
	info.PriceData.GroupRatioInfo = helper.HandleGroupRatio(c, info)
	service.RequestPolicy(c).BeginAttempt(channel, group)
	if err := middleware.SetupContextForSelectedChannel(c, channel, info.OriginModelName); err != nil {
		return nil, err
	}
	return channel, nil
}
func moderationMetadata(c *gin.Context, channelID, attempt int) moderation.Metadata {
	return moderation.Metadata{RequestID: c.GetString(common.RequestIdKey), StartedAt: common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime).Unix(), UserID: common.GetContextKeyInt(c, constant.ContextKeyUserId), TokenID: common.GetContextKeyInt(c, constant.ContextKeyTokenId), Group: common.GetContextKeyString(c, constant.ContextKeyUsingGroup), Model: common.GetContextKeyString(c, constant.ContextKeyOriginalModel), Path: c.Request.URL.Path, ChannelID: channelID, Attempt: attempt}
}
func moderationAttemptDenied(c *gin.Context, channelID int) *types.NewAPIError {
	engine := moderation.Active()
	if engine == nil {
		return nil
	}
	ids := engine.ExcludedChannels(common.GetContextKeyInt(c, constant.ContextKeyUserId), common.GetContextKeyInt(c, constant.ContextKeyTokenId))
	if !slices.Contains(ids, channelID) {
		return nil
	}
	return types.NewErrorWithStatusCode(errors.New("request_moderation_restricted"), types.ErrorCode("request_moderation_restricted"), http.StatusForbidden, types.ErrOptionWithSkipRetry())
}
