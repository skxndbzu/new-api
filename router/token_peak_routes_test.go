package router

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestTokenPeakRoutesAreRegistered(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	routes := make(map[string]struct{}, len(engine.Routes()))
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = struct{}{}
	}

	_, hasConfig := routes[http.MethodGet+" /api/token-rankings/config"]
	_, hasToday := routes[http.MethodGet+" /api/token-rankings/today"]
	_, hasRecords := routes[http.MethodGet+" /api/token-rankings/records"]
	_, hasConfigUpdate := routes[http.MethodPut+" /api/token-rankings/config"]
	assert.True(t, hasConfig)
	assert.True(t, hasToday)
	assert.True(t, hasRecords)
	assert.True(t, hasConfigUpdate)
}
