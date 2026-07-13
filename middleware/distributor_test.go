package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetModelRequestPreservesPlaygroundGroup(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name string
		path string
	}{
		{name: "chat completions", path: "/pg/chat/completions"},
		{name: "image generations", path: "/pg/images/generations"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(
				http.MethodPost,
				tt.path,
				bytes.NewBufferString(`{"model":"gpt-image-1","group":"premium"}`),
			)
			c.Request.Header.Set("Content-Type", "application/json")
			t.Cleanup(func() { common.CleanupBodyStorage(c) })

			modelRequest, shouldSelectChannel, err := getModelRequest(c)

			require.NoError(t, err)
			require.NotNil(t, modelRequest)
			assert.True(t, shouldSelectChannel)
			assert.Equal(t, "gpt-image-1", modelRequest.Model)
			assert.Equal(t, "premium", modelRequest.Group)
		})
	}
}
