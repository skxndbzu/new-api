package model

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTokenRankingTest(t *testing.T) {
	t.Helper()
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TokenRankingDay{}, &TokenRankingReward{}))
	require.NoError(t, DB.Exec("DELETE FROM token_ranking_rewards").Error)
	require.NoError(t, DB.Exec("DELETE FROM token_ranking_days").Error)
	t.Cleanup(func() {
		DB.Exec("DELETE FROM token_ranking_rewards")
		DB.Exec("DELETE FROM token_ranking_days")
	})
}

func TestGetTokenRankingTotalsUsesTokenSumAndUserIDTieBreak(t *testing.T) {
	setupTokenRankingTest(t)
	rows := []QuotaData{
		{UserID: 2, Username: "bob", CreatedAt: 1100, TokenUsed: 100},
		{UserID: 1, Username: "alice", CreatedAt: 1200, TokenUsed: 40},
		{UserID: 1, Username: "alice", CreatedAt: 1300, TokenUsed: 60},
		{UserID: 3, Username: "carol", CreatedAt: 1400, TokenUsed: 50},
		{UserID: 3, Username: "carol", CreatedAt: 2100, TokenUsed: 500},
	}
	require.NoError(t, DB.Create(&rows).Error)

	rankings, err := GetTokenRankingTotals(1000, 2000, 10)
	require.NoError(t, err)
	require.Len(t, rankings, 3)
	assert.Equal(t, []int{1, 2, 3}, []int{rankings[0].UserID, rankings[1].UserID, rankings[2].UserID})
	assert.Equal(t, int64(100), rankings[0].TotalTokens)
	assert.Equal(t, "alice", rankings[0].RankingName)

	bob, err := GetTokenRankingUserTotal(2, 1000, 2000)
	require.NoError(t, err)
	assert.Equal(t, int64(100), bob.TotalTokens)
	ahead, err := CountTokenRankingUsersAhead(2, bob.TotalTokens, 1000, 2000)
	require.NoError(t, err)
	assert.Equal(t, int64(1), ahead)
}

func TestSettleTokenRankingDayAwardsQuotaExactlyOnce(t *testing.T) {
	setupTokenRankingTest(t)
	users := []User{
		{Id: 1, Username: "alice", Password: "password", AffCode: "rank-alice", Quota: 10},
		{Id: 2, Username: "bob", Password: "password", AffCode: "rank-bob", Quota: 20},
	}
	require.NoError(t, DB.Create(&users).Error)
	day := TokenRankingDay{
		RankingDate:    "2026-08-04",
		ChampionUserID: 1,
		ChampionName:   "alice",
		ChampionTokens: 1000,
		RewardCount:    2,
		SettledAt:      2000,
	}
	entries := []TokenRankingSettlementEntry{
		{Position: 1, UserID: 1, RankingName: "alice", TotalTokens: 1000, RewardQuota: 100},
		{Position: 2, UserID: 2, RankingName: "bob", TotalTokens: 900, RewardQuota: 50},
	}

	created, awards, err := SettleTokenRankingDay(day, entries)
	require.NoError(t, err)
	require.True(t, created)
	require.Len(t, awards, 2)

	created, awards, err = SettleTokenRankingDay(day, entries)
	require.NoError(t, err)
	assert.False(t, created)
	assert.Empty(t, awards)

	var settledUsers []User
	require.NoError(t, DB.Where("id IN ?", []int{1, 2}).Order("id ASC").Find(&settledUsers).Error)
	require.Len(t, settledUsers, 2)
	assert.Equal(t, 110, settledUsers[0].Quota)
	assert.Equal(t, 70, settledUsers[1].Quota)

	var rewardCount int64
	require.NoError(t, DB.Model(&TokenRankingReward{}).Count(&rewardCount).Error)
	assert.Equal(t, int64(2), rewardCount)
}

func TestSettleTokenRankingDaySaturatesQuotaWithoutNegativeAward(t *testing.T) {
	setupTokenRankingTest(t)
	require.NoError(t, DB.Create(&User{Id: 1, Username: "alice", Password: "password", AffCode: "rank-cap", Quota: math.MaxInt32 - 5}).Error)
	day := TokenRankingDay{
		RankingDate:    "2026-08-05",
		ChampionUserID: 1,
		ChampionName:   "alice",
		ChampionTokens: 1000,
		RewardCount:    1,
		SettledAt:      3000,
	}
	entries := []TokenRankingSettlementEntry{
		{Position: 1, UserID: 1, RankingName: "alice", TotalTokens: 1000, RewardQuota: 10},
	}

	created, awards, err := SettleTokenRankingDay(day, entries)
	require.NoError(t, err)
	require.True(t, created)
	require.Len(t, awards, 1)
	assert.Equal(t, 5, awards[0].AwardedQuota)

	var user User
	require.NoError(t, DB.First(&user, 1).Error)
	assert.Equal(t, math.MaxInt32, user.Quota)
	var reward TokenRankingReward
	require.NoError(t, DB.Where("ranking_date = ?", day.RankingDate).First(&reward).Error)
	assert.Equal(t, 5, reward.AwardedQuota)
}

func TestSettleTokenRankingDayRejectsNegativeRewardAtomically(t *testing.T) {
	setupTokenRankingTest(t)
	require.NoError(t, DB.Create(&User{Id: 1, Username: "alice", Password: "password", AffCode: "rank-negative", Quota: 10}).Error)
	day := TokenRankingDay{RankingDate: "2026-08-06", RewardCount: 1, SettledAt: 4000}
	entries := []TokenRankingSettlementEntry{{Position: 1, UserID: 1, RewardQuota: -1}}

	created, _, err := SettleTokenRankingDay(day, entries)
	require.Error(t, err)
	assert.False(t, created)

	var dayCount int64
	require.NoError(t, DB.Model(&TokenRankingDay{}).Where("ranking_date = ?", day.RankingDate).Count(&dayCount).Error)
	assert.Zero(t, dayCount)
	var user User
	require.NoError(t, DB.First(&user, 1).Error)
	assert.Equal(t, 10, user.Quota)
}
