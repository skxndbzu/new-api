package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func updateRewardRateForTest(t *testing.T, value string) (bool, string) {
	t.Helper()
	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(
		http.MethodPut,
		"/api/option/",
		strings.NewReader(`{"key":"RedemptionInviterRewardRateBps","value":"`+value+`"}`),
	)

	UpdateOption(context)

	var payload struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
	return payload.Success, payload.Message
}

func TestUpdateOptionRejectsInvalidRedemptionInviterRewardRate(t *testing.T) {
	confirmPaymentComplianceForTest(t)

	for _, value := range []string{"-1", "10001", "1.5"} {
		t.Run(value, func(t *testing.T) {
			success, message := updateRewardRateForTest(t, value)
			assert.False(t, success)
			assert.Contains(t, message, "0 and 10000")
		})
	}
}

func TestUpdateOptionRequiresComplianceForEnabledRedemptionReward(t *testing.T) {
	paymentSetting := operation_setting.GetPaymentSetting()
	previousConfirmed := paymentSetting.ComplianceConfirmed
	previousTermsVersion := paymentSetting.ComplianceTermsVersion
	t.Cleanup(func() {
		paymentSetting.ComplianceConfirmed = previousConfirmed
		paymentSetting.ComplianceTermsVersion = previousTermsVersion
	})
	paymentSetting.ComplianceConfirmed = false
	paymentSetting.ComplianceTermsVersion = ""

	success, _ := updateRewardRateForTest(t, "300")
	assert.False(t, success)
}
