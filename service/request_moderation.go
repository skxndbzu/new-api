package service

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	moderation "github.com/QuantumNous/new-api/pkg/requestmoderation"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

// Refresh before every actual selection, including retries, pins and affinity.
// Existing filters are replaced so an expired/released restriction can recover.
func applyRequestModerationConstraints(c *gin.Context) {
	engine := moderation.Active()
	if engine == nil || c == nil {
		return
	}
	constraints := GetChannelConstraints(c)
	filters := constraints.Filters[:0]
	for _, filter := range constraints.Filters {
		if filter.Kind != dto.FilterRequestModeration {
			filters = append(filters, filter)
		}
	}
	constraints.Filters = filters
	ids := engine.ExcludedChannels(common.GetContextKeyInt(c, constant.ContextKeyUserId), common.GetContextKeyInt(c, constant.ContextKeyTokenId))
	if len(ids) > 0 {
		constraints.AddFilter(dto.ChannelFilter{Kind: dto.FilterRequestModeration, ExcludedChannelIDs: ids})
	}
}

func RequestModerationSelectionError(c *gin.Context, retry *RetryParam) *types.NewAPIError {
	constraints := GetChannelConstraints(c)
	var remaining []dto.ChannelFilter
	restricted := false
	for _, filter := range constraints.Filters {
		if filter.Kind == dto.FilterRequestModeration {
			restricted = restricted || len(filter.ExcludedChannelIDs) > 0
			continue
		}
		remaining = append(remaining, filter)
	}
	if !restricted {
		return nil
	}
	denied := types.NewErrorWithStatusCode(errors.New("request_moderation_restricted"), types.ErrorCode("request_moderation_restricted"), http.StatusForbidden, types.ErrOptionWithSkipRetry())
	if pin, found, _ := constraints.ResolvedPin(); found {
		channel, err := model.CacheGetChannel(pin.ChannelId)
		if err == nil && channel != nil {
			if ok, kind := model.ChannelSatisfiesFilters(channel, retry.ModelName, constraints.Filters); !ok && kind == dto.FilterRequestModeration {
				return denied
			}
		}
		return nil
	}
	// Attribute a failure to moderation only when removing this filter would
	// make a candidate available. Unrelated unavailable models keep their error.
	groups := []string{retry.TokenGroup}
	if retry.TokenGroup == "auto" {
		groups = GetRequestAutoGroups(c, common.GetContextKeyString(c, constant.ContextKeyUserGroup))
	}
	for _, group := range groups {
		channel, err := model.GetRandomSatisfiedChannel(group, retry.ModelName, retry.GetRetry(), remaining)
		if err == nil && channel != nil {
			return denied
		}
	}
	return nil
}
