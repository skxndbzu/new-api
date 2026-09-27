package sub2api

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLAlphaSearch(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeSub2API,
			ChannelBaseUrl: "https://sub2api.example",
		},
		RequestURLPath: "/v1/alpha/search",
		RelayMode:      relayconstant.RelayModeAlphaSearch,
	}

	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://sub2api.example/v1/alpha/search", url)
}

func TestAdaptorInheritsNewAPIResponsesCompactSupport(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeSub2API,
			ChannelBaseUrl: "https://sub2api.example",
		},
		RequestURLPath: "/v1/responses/compact",
		RelayMode:      relayconstant.RelayModeResponsesCompact,
	}

	url, err := adaptor.GetRequestURL(info)

	require.NoError(t, err)
	assert.Equal(t, "https://sub2api.example/v1/responses/compact", url)
	assert.Equal(t, "sub2api", adaptor.GetChannelName())
	assert.Empty(t, adaptor.GetModelList())
}

func TestAdaptorInheritsMultipartImageEditSupport(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "gpt-image-2"))
	require.NoError(t, writer.WriteField("group", "playground-group"))
	require.NoError(t, writer.WriteField("prompt", "combine these images"))
	for index := 0; index < 2; index++ {
		part, err := writer.CreateFormFile("image[]", "input.png")
		require.NoError(t, err)
		_, err = part.Write([]byte{byte(index)})
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAIImage,
		RelayMode:   relayconstant.RelayModeImagesEdits,
	}

	converted, err := (&Adaptor{}).ConvertImageRequest(c, info, dto.ImageRequest{Model: "gpt-image-2"})
	require.NoError(t, err)
	convertedBody, ok := converted.(*bytes.Buffer)
	require.True(t, ok)

	upstreamRequest := httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(convertedBody.Bytes()))
	upstreamRequest.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
	require.NoError(t, upstreamRequest.ParseMultipartForm(32<<20))
	assert.Equal(t, "gpt-image-2", upstreamRequest.PostForm.Get("model"))
	assert.Equal(t, "combine these images", upstreamRequest.PostForm.Get("prompt"))
	assert.Empty(t, upstreamRequest.PostForm.Get("group"))
	require.Len(t, upstreamRequest.MultipartForm.File["image[]"], 2)
}

func TestConvertClaudeRequestPreservesAdaptiveThinkingForCompatibleModel(t *testing.T) {
	adaptor := &Adaptor{}
	maxTokens := uint(8192)
	temperature := 0.2
	topP := 0.99
	request := &dto.ClaudeRequest{
		Model:        "gpt-5.6-sol",
		MaxTokens:    &maxTokens,
		Temperature:  &temperature,
		TopP:         &topP,
		Thinking:     &dto.Thinking{Type: "adaptive", Display: "summarized"},
		OutputConfig: json.RawMessage(`{"effort":"xhigh","provider_option":true}`),
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "hello"},
		},
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-5.6-sol",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeSub2API,
		},
	}

	converted, err := adaptor.ConvertClaudeRequest(nil, info, request)

	require.NoError(t, err)
	assert.Same(t, request, converted)
	require.NotNil(t, request.Thinking)
	assert.Equal(t, "adaptive", request.Thinking.Type)
	assert.Equal(t, "summarized", request.Thinking.Display)
	assert.JSONEq(t, `{"effort":"xhigh","provider_option":true}`, string(request.OutputConfig))
	assert.Same(t, &temperature, request.Temperature)
	assert.Same(t, &topP, request.TopP)
	assert.Equal(t, "xhigh", info.ReasoningEffort)
	assert.Equal(t, "gpt-5.6-sol", info.UpstreamModelName)
}
