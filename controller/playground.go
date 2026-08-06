package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

const (
	playgroundImageStreamHeader = "X-New-Api-Image-Stream"
	playgroundImageStreamAuto   = "auto"
	playgroundImageStreamActive = "enabled"
	playgroundImageStreamBuffer = "buffered"
	playgroundImageOriginalBody = "playground_image_original_body"
)

func Playground(c *gin.Context) {
	var newAPIError *types.NewAPIError

	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()

	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		newAPIError = types.NewError(errors.New("暂不支持使用 access token"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAI, nil, nil)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	userId := c.GetInt("id")

	// Write user context to ensure acceptUnsetRatio is available
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		return
	}
	userCache.WriteContext(c)

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)

	Relay(c, types.RelayFormatOpenAI)
}

func PlaygroundImage(c *gin.Context) {
	var newAPIError *types.NewAPIError

	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()

	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		newAPIError = types.NewError(errors.New("暂不支持使用 access token"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAIImage, nil, nil)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	userId := c.GetInt("id")

	userCache, err := model.GetUserCache(userId)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		return
	}
	userCache.WriteContext(c)

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-image-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)

	Relay(c, types.RelayFormatOpenAIImage)
}

// negotiatePlaygroundImageStream turns the drawing page's auto preference
// into stream=true only after distributor middleware has selected a channel
// explicitly marked as image-stream capable. Unsupported channels keep the
// original JSON body and complete through the same single request.
func negotiatePlaygroundImageStream(c *gin.Context) error {
	if !strings.EqualFold(strings.TrimSpace(c.GetHeader(playgroundImageStreamHeader)), playgroundImageStreamAuto) ||
		!strings.HasSuffix(c.Request.URL.Path, "/images/generations") {
		return nil
	}

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return err
	}
	originalBody, exists := c.Get(playgroundImageOriginalBody)
	if !exists {
		body, readErr := storage.Bytes()
		if readErr != nil {
			return readErr
		}
		originalBody = append([]byte(nil), body...)
		c.Set(playgroundImageOriginalBody, originalBody)
	}
	body, ok := originalBody.([]byte)
	if !ok {
		return fmt.Errorf("invalid original image request body")
	}

	c.Header(playgroundImageStreamHeader, playgroundImageStreamBuffer)
	channelType := common.GetContextKeyInt(c, constant.ContextKeyChannelType)
	channelSetting, hasSetting := common.GetContextKeyType[dto.ChannelSettings](c, constant.ContextKeyChannelSetting)
	streamEnabled := hasSetting && channelType == constant.ChannelTypeOpenAI && channelSetting.ImageGenerationStreamEnabled
	streamBody := body
	if streamEnabled {
		if !strings.HasPrefix(strings.ToLower(c.GetHeader("Content-Type")), "application/json") {
			return fmt.Errorf("image stream negotiation requires an application/json request")
		}
		var fields map[string]json.RawMessage
		if err := common.Unmarshal(body, &fields); err != nil {
			return err
		}
		streamValue, err := common.Marshal(true)
		if err != nil {
			return err
		}
		fields["stream"] = streamValue
		// The drawing page only renders completed images; suppress upstream previews.
		partialImages, err := common.Marshal(0)
		if err != nil {
			return err
		}
		fields["partial_images"] = partialImages

		streamBody, err = common.Marshal(fields)
		if err != nil {
			return err
		}
		c.Header(playgroundImageStreamHeader, playgroundImageStreamActive)
	}

	streamStorage, err := common.CreateBodyStorage(streamBody)
	if err != nil {
		return err
	}
	_ = storage.Close()
	c.Set(common.KeyBodyStorage, streamStorage)
	c.Request.Body = io.NopCloser(streamStorage)
	c.Request.ContentLength = int64(len(streamBody))
	return nil
}

func applyPlaygroundImageStreamForSelectedChannel(c *gin.Context, info *relaycommon.RelayInfo) error {
	if info == nil || !info.IsPlayground || info.RelayMode != relayconstant.RelayModeImagesGenerations {
		return nil
	}
	if err := negotiatePlaygroundImageStream(c); err != nil {
		return err
	}
	imageRequest, ok := info.Request.(*dto.ImageRequest)
	if !ok {
		return nil
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return err
	}
	body, err := storage.Bytes()
	if err != nil {
		return err
	}
	if err := common.Unmarshal(body, imageRequest); err != nil {
		return err
	}
	info.IsStream = imageRequest.IsStream(c.Request)
	return nil
}
