package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func cleanupInvitationUsers(t *testing.T, userIds ...int) {
	t.Helper()
	t.Cleanup(func() {
		require.NoError(t, DB.Unscoped().Delete(&User{}, userIds).Error)
	})
}

func TestInsertWithTxPersistsOAuthInviterId(t *testing.T) {
	inviter := &User{
		Username: "oauth-inviter", Password: "password", Status: common.UserStatusEnabled,
		AffCode: "oauth-inviter-code",
	}
	require.NoError(t, DB.Create(inviter).Error)
	invitee := &User{Username: "oauth-invitee", Status: common.UserStatusEnabled}
	cleanupInvitationUsers(t, inviter.Id)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return invitee.InsertWithTx(tx, inviter.Id)
	}))
	cleanupInvitationUsers(t, invitee.Id)

	var stored User
	require.NoError(t, DB.First(&stored, "id = ?", invitee.Id).Error)
	assert.Equal(t, inviter.Id, stored.InviterId)
}

func TestFinalizeOAuthUserCreationCountsInviteWithoutFixedReward(t *testing.T) {
	inviter := &User{
		Username: "count-inviter", Password: "password", Status: common.UserStatusEnabled,
		AffCode: "count-inviter-code",
	}
	invitee := &User{
		Username: "count-invitee", Status: common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(inviter).Error)
	cleanupInvitationUsers(t, inviter.Id)

	previousInviterQuota := common.QuotaForInviter
	previousInviteeQuota := common.QuotaForInvitee
	previousNewUserQuota := common.QuotaForNewUser
	previousRewardRate := common.RedemptionInviterRewardRateBps
	paymentSetting := operation_setting.GetPaymentSetting()
	previousComplianceConfirmed := paymentSetting.ComplianceConfirmed
	previousComplianceVersion := paymentSetting.ComplianceTermsVersion
	t.Cleanup(func() {
		common.QuotaForInviter = previousInviterQuota
		common.QuotaForInvitee = previousInviteeQuota
		common.QuotaForNewUser = previousNewUserQuota
		common.RedemptionInviterRewardRateBps = previousRewardRate
		paymentSetting.ComplianceConfirmed = previousComplianceConfirmed
		paymentSetting.ComplianceTermsVersion = previousComplianceVersion
	})
	common.QuotaForInviter = 0
	common.QuotaForInvitee = 0
	common.QuotaForNewUser = 0
	common.RedemptionInviterRewardRateBps = 300
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return invitee.InsertWithTx(tx, inviter.Id)
	}))
	cleanupInvitationUsers(t, invitee.Id)
	invitee.FinalizeOAuthUserCreation(inviter.Id)

	var storedInviter User
	require.NoError(t, DB.First(&storedInviter, "id = ?", inviter.Id).Error)
	assert.Equal(t, 1, storedInviter.AffCount)
	assert.Zero(t, storedInviter.AffQuota)
	assert.Zero(t, storedInviter.AffHistoryQuota)

	redemption := &Redemption{
		Key: "count-invitee-redemption-key-01", Name: "count-invitee-redemption",
		Status: common.RedemptionCodeStatusEnabled, Quota: 10_000,
	}
	require.NoError(t, DB.Create(redemption).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Unscoped().Delete(redemption).Error)
	})

	_, err := Redeem(redemption.Key, invitee.Id)
	require.NoError(t, err)
	require.NoError(t, DB.First(&storedInviter, "id = ?", inviter.Id).Error)
	assert.Equal(t, 1, storedInviter.AffCount)
	assert.Equal(t, 300, storedInviter.AffQuota)
	assert.Equal(t, 300, storedInviter.AffHistoryQuota)
}
