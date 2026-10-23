package relay

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	moderation "github.com/QuantumNous/new-api/pkg/requestmoderation"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// CallModerationText invokes the configured production adaptor and transport,
// without entering relay billing, user rate limits or the public relay router.
// The caller supplies a fresh context populated with ONLY channel settings.
// V1 offers chat-completions review channels; collection covers all text paths.
func CallModerationText(c *gin.Context, model, system, input string) (moderation.CallResult, error) {
	result := moderation.CallResult{}
	request := &dto.GeneralOpenAIRequest{Model: model, Messages: []dto.Message{{Role: "system", Content: system}, {Role: "user", Content: input}}, Stream: common.GetPointer(false), MaxTokens: common.GetPointer(uint(2048))}
	info := relaycommon.GenRelayInfoOpenAI(c, request)
	info.InitChannelMeta(c)
	if err := helper.ModelMappedHelper(c, info, request); err != nil {
		return result, errors.New("invalid_review_model_mapping")
	}
	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return result, errors.New("unsupported_review_channel")
	}
	adaptor.Init(info)
	applySystemPromptIfNeeded(c, info, request)
	converted, err := adaptor.ConvertOpenAIRequest(c, info, request)
	if err != nil {
		return result, errors.New("review_conversion_failed")
	}
	data, err := common.Marshal(converted)
	if err != nil {
		return result, errors.New("review_encoding_failed")
	}
	data, err = relaycommon.RemoveDisabledFields(data, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
	if err != nil {
		return result, errors.New("invalid_review_disabled_fields")
	}
	data, err = relaycommon.ApplyParamOverrideWithRelayInfo(data, info)
	if err != nil {
		return result, errors.New("invalid_review_parameter_override")
	}
	// Overrides are honored, but cannot remove the fixed boundary, enable
	// streaming/tools, or turn a small system call into unbounded generation.
	root := gjson.ParseBytes(data)
	if root.Get("stream").Bool() || root.Get("tools").Exists() || root.Get("functions").Exists() || root.Get("n").Int() > 1 || root.Get("messages.0.role").String() != "system" || root.Get("messages.1.role").String() != "user" || root.Get("messages.0.content").String() != system || root.Get("messages.1.content").String() != input || root.Get("messages.#").Int() != 2 {
		return result, errors.New("review_channel_override_conflict")
	}
	bounded := false
	for _, key := range []string{"max_tokens", "max_completion_tokens", "max_output_tokens"} {
		value := root.Get(key)
		if !value.Exists() {
			continue
		}
		if value.Type != gjson.Number || value.Float() != float64(value.Int()) || value.Int() < 1 || value.Int() > 2048 {
			return result, errors.New("review_output_limit_conflict")
		}
		bounded = true
	}
	if !bounded {
		return result, errors.New("review_output_limit_missing")
	}
	result.Model = root.Get("model").String()
	// An opaque keyed fingerprint tracks configuration changes without storing
	// credentials, override values or the original request in moderation records.
	configData, _ := common.Marshal(map[string]any{"channel_id": info.ChannelId, "type": info.ChannelType, "model": result.Model, "base_url": info.ChannelBaseUrl, "settings": info.ChannelSetting, "other_settings": info.ChannelOtherSettings, "parameter_override": info.ParamOverride, "header_override": info.HeadersOverride})
	hash := hmac.New(sha256.New, []byte(info.ApiKey))
	hash.Write(configData)
	result.Fingerprint = fmt.Sprintf("%x", hash.Sum(nil)[:16])
	response, err := adaptor.DoRequest(c, info, bytes.NewReader(data))
	if err != nil {
		return result, errors.New("review_transport_failed")
	}
	resp, ok := response.(*http.Response)
	if !ok || resp == nil {
		return result, errors.New("review_empty_response")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return result, fmt.Errorf("review_upstream_status_%d", resp.StatusCode)
	}
	if strings.Contains(resp.Header.Get("Content-Type"), "text/event-stream") {
		return result, errors.New("review_streaming_not_supported")
	}
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 256<<10+1))
	if err != nil {
		return result, errors.New("review_response_read_failed")
	}
	if len(responseBody) > 256<<10 {
		return result, errors.New("review_response_too_large")
	}
	if !gjson.ValidBytes(responseBody) {
		return result, errors.New("review_invalid_response")
	}
	root = gjson.ParseBytes(responseBody)
	// Use reported token counts only. Missing pricing is represented as unknown
	// by the management API, never as zero cost or a user quota deduction.
	usage := root.Get("usage")
	for _, key := range []string{"prompt_tokens", "completion_tokens"} {
		value := usage.Get(key)
		if value.Exists() && (value.Type != gjson.Number || value.Float() != float64(value.Int()) || value.Int() < 0 || value.Int() > 2147483647) {
			return result, errors.New("review_invalid_usage")
		}
	}
	result.InputTokens = usage.Get("prompt_tokens").Int()
	result.OutputTokens = usage.Get("completion_tokens").Int()
	result.UsageKnown = usage.Get("prompt_tokens").Exists() && usage.Get("completion_tokens").Exists()
	if root.Get("choices.0.finish_reason").String() == "length" {
		return result, errors.New("review_output_truncated")
	}
	if root.Get("choices.0.message.refusal").String() != "" {
		return result, errors.New("review_model_refusal")
	}
	result.Text = root.Get("choices.0.message.content").String()
	if strings.TrimSpace(result.Text) == "" {
		return result, errors.New("review_empty_output")
	}
	return result, nil
}
