package service

import (
	"errors"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTokenPeakDayRangeUsesAsiaShanghai(t *testing.T) {
	now := time.Date(2026, 8, 4, 16, 5, 0, 0, time.UTC)
	start, end := tokenPeakDayRange(now)

	assert.Equal(t, "2026-08-05 00:00:00 +0800 Asia/Shanghai", start.String())
	assert.Equal(t, "2026-08-06 00:00:00 +0800 Asia/Shanghai", end.String())
}

func TestNextTokenPeakSettlementUses0010Boundary(t *testing.T) {
	before := time.Date(2026, 8, 4, 16, 5, 0, 0, time.UTC)
	after := time.Date(2026, 8, 4, 16, 11, 0, 0, time.UTC)

	assert.True(t, time.Date(2026, 8, 4, 16, 10, 0, 0, time.UTC).Equal(nextTokenPeakSettlement(before)))
	assert.True(t, time.Date(2026, 8, 5, 16, 10, 0, 0, time.UTC).Equal(nextTokenPeakSettlement(after)))
}

func TestTokenPeakTokensNeededHonorsUserIDTieBreak(t *testing.T) {
	target := model.TokenRankingTotal{UserID: 10, TotalTokens: 100}

	assert.Equal(t, int64(20), tokenPeakTokensNeeded(target, model.TokenRankingTotal{UserID: 5, TotalTokens: 80}))
	assert.Equal(t, int64(21), tokenPeakTokensNeeded(target, model.TokenRankingTotal{UserID: 15, TotalTokens: 80}))
}

func TestLongestTokenPeakStreakRequiresConsecutiveDays(t *testing.T) {
	days := []model.TokenRankingDay{
		{RankingDate: "2026-08-01", ChampionUserID: 2, ChampionName: "bob"},
		{RankingDate: "2026-08-02", ChampionUserID: 2, ChampionName: "bob"},
		{RankingDate: "2026-08-04", ChampionUserID: 2, ChampionName: "bob"},
		{RankingDate: "2026-08-05", ChampionUserID: 1, ChampionName: "alice"},
		{RankingDate: "2026-08-06", ChampionUserID: 1, ChampionName: "alice"},
		{RankingDate: "2026-08-07", ChampionUserID: 1, ChampionName: "alice"},
	}

	record := longestTokenPeakStreak(days)
	require.Equal(t, "alice", record.RankingName)
	assert.Equal(t, 3, record.StreakDays)
}
