package router

import (
	"net/http"

	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
)

func registerRequestModerationRoutes(api *gin.RouterGroup) {
	group := api.Group("/request_moderation", middleware.AdminAuth(), middleware.DisableCache())
	for _, route := range []permissionRoute{
		{http.MethodGet, "/overview", authz.RequestModerationRead, controller.ModerationOverview},
		{http.MethodGet, "/records", authz.RequestModerationRead, controller.ModerationRecords},
		{http.MethodGet, "/records/:id", authz.RequestModerationBody, controller.ModerationDetail},
		{http.MethodGet, "/restrictions", authz.RequestModerationRead, controller.ModerationRestrictions},
		{http.MethodGet, "/settings", authz.RequestModerationWrite, controller.ModerationSettings},
		{http.MethodGet, "/channels", authz.RequestModerationWrite, controller.ModerationChannels},
		{http.MethodPut, "/settings", authz.RequestModerationWrite, controller.ModerationSaveSettings},
		{http.MethodPut, "/policies", authz.RequestModerationWrite, controller.ModerationSavePolicy},
		{http.MethodPost, "/test", authz.RequestModerationWrite, controller.ModerationTest},
		{http.MethodPost, "/records/:id/review", authz.RequestModerationReview, controller.ModerationReview},
		{http.MethodPost, "/records/:id/requeue", authz.RequestModerationReview, controller.ModerationRequeue},
		{http.MethodPost, "/restrictions", authz.RequestModerationRestrict, controller.ModerationSaveRestriction},
	} {
		if route.method == http.MethodGet {
			handlePermissionRoute(group, route.method, route.path, route.permission, route.handler)
		} else {
			handlePermissionRoute(group, route.method, route.path, route.permission, middleware.RequestModerationOriginGuard(), middleware.CriticalRateLimit(), controller.ModerationJSONBody, route.handler)
		}
	}
}
