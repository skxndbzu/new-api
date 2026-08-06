package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newPlaygroundImageStreamContext(t *testing.T, body string, enabled bool) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/generations", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Request.Header.Set(playgroundImageStreamHeader, playgroundImageStreamAuto)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{
		ImageGenerationStreamEnabled: enabled,
	})
	t.Cleanup(func() { common.CleanupBodyStorage(c) })
	return c, recorder
}

func TestNegotiatePlaygroundImageStreamEnablesVerifiedChannel(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	c, recorder := newPlaygroundImageStreamContext(t, `{"model":"gpt-image-2","prompt":"draw","n":5,"partial_images":3,"custom":"kept"}`, true)

	require.NoError(t, negotiatePlaygroundImageStream(c))
	storage, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	body, err := storage.Bytes()
	require.NoError(t, err)
	var fields map[string]json.RawMessage
	require.NoError(t, common.Unmarshal(body, &fields))

	var stream bool
	require.NoError(t, common.Unmarshal(fields["stream"], &stream))
	var partialImages int
	require.NoError(t, common.Unmarshal(fields["partial_images"], &partialImages))
	var n int
	require.NoError(t, common.Unmarshal(fields["n"], &n))
	var custom string
	require.NoError(t, common.Unmarshal(fields["custom"], &custom))

	assert.True(t, stream)
	assert.Zero(t, partialImages)
	assert.Equal(t, 5, n)
	assert.Equal(t, "kept", custom)
	assert.Equal(t, playgroundImageStreamActive, recorder.Header().Get(playgroundImageStreamHeader))

	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{})
	require.NoError(t, negotiatePlaygroundImageStream(c))
	fallbackStorage, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	fallbackBody, err := fallbackStorage.Bytes()
	require.NoError(t, err)

	assert.JSONEq(t, `{"model":"gpt-image-2","prompt":"draw","n":5,"partial_images":3,"custom":"kept"}`, string(fallbackBody))
	assert.Equal(t, playgroundImageStreamBuffer, recorder.Header().Get(playgroundImageStreamHeader))
}

func TestNegotiatePlaygroundImageStreamSafelyBuffersUnverifiedChannel(t *testing.T) {
	c, recorder := newPlaygroundImageStreamContext(t, `{"model":"gpt-image-2","prompt":"draw","n":5}`, false)

	require.NoError(t, negotiatePlaygroundImageStream(c))
	storage, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	body, err := storage.Bytes()
	require.NoError(t, err)

	assert.JSONEq(t, `{"model":"gpt-image-2","prompt":"draw","n":5}`, string(body))
	assert.Equal(t, playgroundImageStreamBuffer, recorder.Header().Get(playgroundImageStreamHeader))
}

func TestApplyPlaygroundImageStreamResetsRequestForRetryChannel(t *testing.T) {
	c, recorder := newPlaygroundImageStreamContext(t, `{"model":"gpt-image-2","prompt":"draw","n":5}`, true)
	request := &dto.ImageRequest{}
	info := &relaycommon.RelayInfo{
		IsPlayground: true,
		RelayMode:    relayconstant.RelayModeImagesGenerations,
		Request:      request,
	}

	require.NoError(t, applyPlaygroundImageStreamForSelectedChannel(c, info))
	require.NotNil(t, request.Stream)
	assert.True(t, *request.Stream)
	var partialImages int
	require.NoError(t, common.Unmarshal(request.PartialImages, &partialImages))
	assert.Zero(t, partialImages)
	assert.True(t, info.IsStream)
	assert.Equal(t, playgroundImageStreamActive, recorder.Header().Get(playgroundImageStreamHeader))

	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{})
	require.NoError(t, applyPlaygroundImageStreamForSelectedChannel(c, info))
	assert.Nil(t, request.Stream)
	assert.Empty(t, request.PartialImages)
	assert.False(t, info.IsStream)
	assert.Equal(t, playgroundImageStreamBuffer, recorder.Header().Get(playgroundImageStreamHeader))
}
