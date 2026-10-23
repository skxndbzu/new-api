package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RequestModerationOriginGuard reuses the dashboard's trusted-origin policy,
// including on HTTP development installations. Install after AdminAuth: only
// its verified access-token context can exempt a non-browser API request.
func RequestModerationOriginGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetBool("use_access_token") && len(c.Request.Header.Values("Origin")) == 0 && len(c.Request.Header.Values("Referer")) == 0 {
			c.Next()
			return
		}
		origin, ok := requestBrowserOrigin(c.Request)
		if !ok || !isAllowedSessionOrigin(c.Request, origin) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"success": false, "code": "AUTH_ORIGIN_FORBIDDEN", "message": "request origin is not allowed"})
			return
		}
		c.Next()
	}
}
