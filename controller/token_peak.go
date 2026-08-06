package controller

import (
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func GetTokenPeakConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    service.GetTokenPeakConfig(time.Now()),
	})
}

func GetTokenPeakToday(c *gin.Context) {
	data, err := service.GetTokenPeakToday(c.GetInt("id"), time.Now())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

func GetTokenPeakRecords(c *gin.Context) {
	data, err := service.GetTokenPeakRecords()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

func UpdateTokenPeakConfig(c *gin.Context) {
	var request dto.UpdateTokenPeakConfigRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request body",
		})
		return
	}
	data, err := service.UpdateTokenPeakConfig(request, time.Now())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	recordManageAudit(c, "token_peak.config_update", map[string]interface{}{
		"enabled":      request.Enabled,
		"reward_count": request.RewardCount,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}
