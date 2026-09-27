package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPublicContentRevalidationPreservesLocalizedDocuments(t *testing.T) {
	for _, tc := range []struct {
		name    string
		content any
		updated any
		body    string
	}{
		{"text", "Agreement", "Updated agreement", `{"success":true,"message":"","data":"Agreement"}`},
		{"localized", map[string]string{"en": "Agreement", "zh": "协议"}, map[string]string{"en": "Agreement", "zh": "新版协议"}, `{"success":true,"message":"","data":{"en":"Agreement","zh":"协议"}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user-agreement", nil)
			serveRevalidatedJSON(ctx, tc.content)
			require.Equal(t, http.StatusOK, recorder.Code)
			assert.JSONEq(t, tc.body, recorder.Body.String())
			etag := recorder.Header().Get("ETag")
			require.NotEmpty(t, etag)
			assert.Equal(t, "no-cache", recorder.Header().Get("Cache-Control"))

			recorder = httptest.NewRecorder()
			ctx, _ = gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user-agreement", nil)
			ctx.Request.Header.Set("If-None-Match", etag)
			serveRevalidatedJSON(ctx, tc.content)
			ctx.Writer.WriteHeaderNow()
			assert.Equal(t, http.StatusNotModified, recorder.Code)
			assert.Empty(t, recorder.Body.String())

			recorder = httptest.NewRecorder()
			ctx, _ = gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user-agreement", nil)
			ctx.Request.Header.Set("If-None-Match", etag)
			serveRevalidatedJSON(ctx, tc.updated)
			assert.Equal(t, http.StatusOK, recorder.Code)
			assert.NotEqual(t, etag, recorder.Header().Get("ETag"))
		})
	}
}
