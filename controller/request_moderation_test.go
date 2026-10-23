package controller

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	moderation "github.com/QuantumNous/new-api/pkg/requestmoderation"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestModerationChannelCallUsesProductionConfiguration(t *testing.T) {
	user, _ := setupAccessTokenAudit(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}))
	service.InitHttpClient()
	for _, channelType := range []int{constant.ChannelTypeOpenAI, constant.ChannelTypeDeepSeek, constant.ChannelTypeZhipu_v4, constant.ChannelTypeNewAPI} {
		t.Run(constant.GetChannelTypeName(channelType), func(t *testing.T) {
			var gotBody []byte
			var gotHeader http.Header
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotBody, _ = io.ReadAll(r.Body)
				gotHeader = r.Header.Clone()
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"choices":[{"finish_reason":"stop","message":{"content":"{\"verdict\":\"safe\",\"categories\":[],\"severity\":\"low\",\"reason\":\"authorized testing\",\"evidence\":[],\"needs_review\":false}"}}],"usage":{"prompt_tokens":31,"completion_tokens":20}}`)
			}))
			defer upstream.Close()
			channel := model.Channel{Type: channelType, Name: "review", Status: common.ChannelStatusEnabled, Key: "review-secret", BaseURL: common.GetPointer(upstream.URL), Models: "review-alias", ModelMapping: common.GetPointer(`{"review-alias":"review-real"}`), HeaderOverride: common.GetPointer(`{"X-Review-Configured":"yes"}`)}
			require.NoError(t, model.DB.Create(&channel).Error)
			result, err := callModerationChannel(context.Background(), moderation.Target{ChannelID: channel.Id, Model: "review-alias", Protocol: "chat"}, "fixed-system", "untrusted-data")
			require.NoError(t, err)
			assert.Equal(t, "review-real", result.Model)
			assert.EqualValues(t, 31, result.InputTokens)
			assert.EqualValues(t, 20, result.OutputTokens)
			assert.Equal(t, "review-real", gjson.GetBytes(gotBody, "model").String())
			assert.Equal(t, "fixed-system", gjson.GetBytes(gotBody, "messages.0.content").String())
			assert.False(t, gjson.GetBytes(gotBody, "tools").Exists())
			assert.Equal(t, "Bearer review-secret", gotHeader.Get("Authorization"))
			assert.Equal(t, "yes", gotHeader.Get("X-Review-Configured"))
			assert.Empty(t, gotHeader.Get("Cookie"))
			// An override that breaks the fixed prompt is exposed as an error.
			require.NoError(t, model.DB.Model(&channel).Update("param_override", `{"messages":[{"role":"user","content":"override"}]}`).Error)
			_, err = callModerationChannel(context.Background(), moderation.Target{ChannelID: channel.Id, Model: "review-alias", Protocol: "chat"}, "fixed-system", "untrusted-data")
			assert.ErrorContains(t, err, "override_conflict")
			require.NoError(t, model.DB.Model(&channel).Update("status", common.ChannelStatusManuallyDisabled).Error)
			_, err = callModerationChannel(context.Background(), moderation.Target{ChannelID: channel.Id, Model: "review-alias", Protocol: "chat"}, "fixed-system", "untrusted-data")
			assert.ErrorContains(t, err, "disabled")
		})
	}
	var fresh model.User
	require.NoError(t, model.DB.First(&fresh, user.Id).Error)
	assert.Equal(t, user.Quota, fresh.Quota)
	var logs int64
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).Count(&logs).Error)
	assert.Zero(t, logs)
}

func TestModerationPermissionsAndJSONBoundary(t *testing.T) {
	user, credential := setupAccessTokenAudit(t)
	oldSecure := common.SessionCookieSecure
	common.SessionCookieSecure = false
	t.Cleanup(func() { common.SessionCookieSecure = oldSecure })
	router := gin.New()
	router.GET("/api/request_moderation/records/:id", middleware.AdminAuth(), middleware.RequirePermission(authz.RequestModerationBody), ModerationDetail)
	router.POST("/api/request_moderation/test", middleware.AdminAuth(), middleware.RequirePermission(authz.RequestModerationWrite), middleware.RequestModerationOriginGuard(), ModerationJSONBody, func(c *gin.Context) { c.JSON(200, gin.H{"success": true}) })
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/request_moderation/records/1", nil))
	assert.Equal(t, http.StatusUnauthorized, response.Code)
	request := httptest.NewRequest(http.MethodGet, "/api/request_moderation/records/1", nil)
	request.Header.Set("Authorization", "Bearer "+credential)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Equal(t, http.StatusForbidden, response.Code)
	require.NoError(t, authz.SetUserPermissions(user.Id, authz.PermissionsMap{authz.ResourceRequestModeration: {authz.ActionWrite: true}}))
	for _, tc := range []struct {
		origin, contentType string
		want                int
	}{{"https://evil.example", "application/json", 403}, {"http://example.com", "text/plain", 415}, {"http://example.com", "application/json", 200}, {"", "application/json", 200}} {
		request = httptest.NewRequest(http.MethodPost, "http://example.com/api/request_moderation/test", strings.NewReader(`{}`))
		request.Header.Set("Authorization", "Bearer "+credential)
		if tc.origin != "" {
			request.Header.Set("Origin", tc.origin)
		}
		request.Header.Set("Content-Type", tc.contentType)
		response = httptest.NewRecorder()
		router.ServeHTTP(response, request)
		assert.Equal(t, tc.want, response.Code)
	}
	cookieRouter := gin.New()
	cookieRouter.POST("/mutation", middleware.RequestModerationOriginGuard(), ModerationJSONBody, func(c *gin.Context) { c.Status(200) })
	for _, origin := range []string{"", "null", "https://evil.example", "http://example.com"} {
		request := httptest.NewRequest("POST", "http://example.com/mutation", strings.NewReader(`{}`))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer unverified-client-header")
		if origin != "" {
			request.Header.Set("Origin", origin)
		}
		response := httptest.NewRecorder()
		cookieRouter.ServeHTTP(response, request)
		want := 403
		if origin == "http://example.com" {
			want = 200
		}
		assert.Equal(t, want, response.Code)
	}
}
