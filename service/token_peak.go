package service

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	tokenPeakTimezone         = "Asia/Shanghai"
	tokenPeakRankingCacheTTL  = 5 * time.Minute
	tokenPeakSettlementHour   = 0
	tokenPeakSettlementMinute = 10
	tokenPeakSettlementTick   = time.Minute
	tokenPeakTopLimit         = 10
)

var tokenPeakLocation = time.FixedZone(tokenPeakTimezone, 8*60*60)

type tokenPeakRankingCacheValue struct {
	startTime int64
	endTime   int64
	expiresAt time.Time
	updatedAt int64
	rankings  []model.TokenRankingTotal
}

var (
	tokenPeakRankingCacheMu sync.RWMutex
	tokenPeakRankingCache   tokenPeakRankingCacheValue
	tokenPeakSettlementOnce sync.Once
	tokenPeakSettlementBusy atomic.Bool
)

func GetTokenPeakConfig(now time.Time) dto.TokenPeakConfig {
	setting := operation_setting.GetTokenPeakSetting()
	rewards := make([]dto.TokenPeakReward, 0, len(setting.Rewards))
	for _, reward := range setting.Rewards {
		rewards = append(rewards, dto.TokenPeakReward{
			Position:    reward.Position,
			RewardQuota: reward.RewardQuota,
		})
	}
	return dto.TokenPeakConfig{
		Enabled:          setting.Enabled,
		RewardCount:      setting.RewardCount,
		Rewards:          rewards,
		NextSettlementAt: nextTokenPeakSettlement(now).Unix(),
	}
}

func UpdateTokenPeakConfig(request dto.UpdateTokenPeakConfigRequest, now time.Time) (dto.TokenPeakConfig, error) {
	current := operation_setting.GetTokenPeakSetting()
	rewards := make([]operation_setting.TokenPeakReward, 0, len(request.Rewards))
	for _, reward := range request.Rewards {
		rewards = append(rewards, operation_setting.TokenPeakReward{
			Position:    reward.Position,
			RewardQuota: reward.RewardQuota,
		})
	}
	next := operation_setting.TokenPeakSetting{
		Enabled:     request.Enabled,
		RewardCount: request.RewardCount,
		Rewards:     rewards,
		StartedAt:   current.StartedAt,
	}
	if request.Enabled && !current.Enabled {
		next.StartedAt = now.Unix()
	}
	if err := operation_setting.ValidateTokenPeakSetting(next); err != nil {
		return dto.TokenPeakConfig{}, err
	}
	rewardJSON, err := common.Marshal(next.Rewards)
	if err != nil {
		return dto.TokenPeakConfig{}, err
	}
	err = model.UpdateOptionsBulk(map[string]string{
		"token_peak_setting.enabled":      strconv.FormatBool(next.Enabled),
		"token_peak_setting.reward_count": strconv.Itoa(next.RewardCount),
		"token_peak_setting.rewards":      string(rewardJSON),
		"token_peak_setting.started_at":   strconv.FormatInt(next.StartedAt, 10),
	})
	if err != nil {
		return dto.TokenPeakConfig{}, err
	}
	return GetTokenPeakConfig(now), nil
}

func GetTokenPeakToday(userID int, now time.Time) (dto.TokenPeakToday, error) {
	start, end := tokenPeakDayRange(now)
	rankings, updatedAt, err := getTokenPeakRankings(start.Unix(), end.Unix(), now)
	if err != nil {
		return dto.TokenPeakToday{}, err
	}
	setting := operation_setting.GetTokenPeakSetting()
	rewardByPosition := make(map[int]int, len(setting.Rewards))
	for _, reward := range setting.Rewards {
		rewardByPosition[reward.Position] = reward.RewardQuota
	}

	entries := make([]dto.TokenPeakRankingEntry, 0, len(rankings))
	for index, ranking := range rankings {
		position := index + 1
		entry := dto.TokenPeakRankingEntry{
			Position:    position,
			RankingName: ranking.RankingName,
			TotalTokens: ranking.TotalTokens,
		}
		if position > 1 {
			gap := tokenPeakTokensNeeded(rankings[index-1], ranking)
			entry.TokensToOvertake = &gap
		}
		if rewardQuota, ok := rewardByPosition[position]; ok {
			reward := rewardQuota
			entry.RewardQuota = &reward
		}
		entries = append(entries, entry)
	}

	performance, err := getTokenPeakUserPerformance(userID, start.Unix(), end.Unix(), rankings, rewardByPosition)
	if err != nil {
		return dto.TokenPeakToday{}, err
	}
	return dto.TokenPeakToday{
		Rankings:  entries,
		MyRanking: performance,
		UpdatedAt: updatedAt,
		Timezone:  tokenPeakTimezone,
	}, nil
}

func getTokenPeakUserPerformance(
	userID int,
	startTime int64,
	endTime int64,
	rankings []model.TokenRankingTotal,
	rewardByPosition map[int]int,
) (dto.TokenPeakUserPerformance, error) {
	performance := dto.TokenPeakUserPerformance{}
	userTotal, err := model.GetTokenRankingUserTotal(userID, startTime, endTime)
	if err != nil {
		return performance, err
	}
	performance.TotalTokens = userTotal.TotalTokens

	if userTotal.TotalTokens > 0 {
		ahead, err := model.CountTokenRankingUsersAhead(userID, userTotal.TotalTokens, startTime, endTime)
		if err != nil {
			return performance, err
		}
		position64 := ahead + 1
		if position64 <= tokenPeakTopLimit {
			position := int(position64)
			performance.CurrentPosition = &position
			if rewardQuota, ok := rewardByPosition[position]; ok {
				reward := rewardQuota
				performance.EstimatedRewardQuota = &reward
				rewardPosition := position
				performance.RewardPosition = &rewardPosition
			}
			if position > 1 && position-2 < len(rankings) {
				target := rankings[position-2]
				gap := tokenPeakTokensNeeded(target, model.TokenRankingTotal{
					UserID:      userID,
					TotalTokens: userTotal.TotalTokens,
				})
				performance.TokensToOvertake = &gap
				targetPosition := position - 1
				performance.OvertakePosition = &targetPosition
			}
			return performance, nil
		}
	}

	if len(rankings) < tokenPeakTopLimit {
		gap := int64(1)
		performance.TokensToRank = &gap
		targetPosition := len(rankings) + 1
		performance.TargetPosition = &targetPosition
		return performance, nil
	}
	target := rankings[tokenPeakTopLimit-1]
	gap := tokenPeakTokensNeeded(target, model.TokenRankingTotal{
		UserID:      userID,
		TotalTokens: userTotal.TotalTokens,
	})
	performance.TokensToRank = &gap
	targetPosition := tokenPeakTopLimit
	performance.TargetPosition = &targetPosition
	return performance, nil
}

func tokenPeakTokensNeeded(target, contender model.TokenRankingTotal) int64 {
	difference := target.TotalTokens - contender.TotalTokens
	if difference < 0 {
		return 0
	}
	if contender.UserID < target.UserID {
		return difference
	}
	if difference == math.MaxInt64 {
		return math.MaxInt64
	}
	return difference + 1
}

func getTokenPeakRankings(startTime, endTime int64, now time.Time) ([]model.TokenRankingTotal, int64, error) {
	tokenPeakRankingCacheMu.RLock()
	cached := tokenPeakRankingCache
	if cached.startTime == startTime && cached.endTime == endTime && now.Before(cached.expiresAt) {
		rankings := append([]model.TokenRankingTotal(nil), cached.rankings...)
		tokenPeakRankingCacheMu.RUnlock()
		return rankings, cached.updatedAt, nil
	}
	tokenPeakRankingCacheMu.RUnlock()

	rankings, err := model.GetTokenRankingTotals(startTime, endTime, tokenPeakTopLimit)
	if err != nil {
		return nil, 0, err
	}
	updatedAt := now.Unix()
	tokenPeakRankingCacheMu.Lock()
	tokenPeakRankingCache = tokenPeakRankingCacheValue{
		startTime: startTime,
		endTime:   endTime,
		expiresAt: now.Add(tokenPeakRankingCacheTTL),
		updatedAt: updatedAt,
		rankings:  append([]model.TokenRankingTotal(nil), rankings...),
	}
	tokenPeakRankingCacheMu.Unlock()
	return rankings, updatedAt, nil
}

func invalidateTokenPeakRankingCache() {
	tokenPeakRankingCacheMu.Lock()
	tokenPeakRankingCache = tokenPeakRankingCacheValue{}
	tokenPeakRankingCacheMu.Unlock()
}

func GetTokenPeakRecords() (dto.TokenPeakRecords, error) {
	var records dto.TokenPeakRecords
	highest, err := model.GetHighestTokenRankingDay()
	if err != nil {
		return records, err
	}
	if highest != nil {
		records.HighestDailyTokens = dto.TokenPeakHighestDailyRecord{
			RankingName:    highest.ChampionName,
			ChampionTokens: highest.ChampionTokens,
			Date:           highest.RankingDate,
		}
	}
	most, err := model.GetMostTokenRankingChampionships()
	if err != nil {
		return records, err
	}
	if most != nil {
		records.MostChampionships = dto.TokenPeakChampionshipRecord{
			RankingName:   most.ChampionName,
			ChampionCount: most.ChampionCount,
		}
	}
	days, err := model.ListTokenRankingChampionDays()
	if err != nil {
		return records, err
	}
	records.LongestStreak = longestTokenPeakStreak(days)
	return records, nil
}

func longestTokenPeakStreak(days []model.TokenRankingDay) dto.TokenPeakStreakRecord {
	var best dto.TokenPeakStreakRecord
	bestUserID := math.MaxInt
	currentUserID := 0
	currentName := ""
	currentLength := 0
	var previousDate time.Time
	for _, day := range days {
		date, err := time.ParseInLocation("2006-01-02", day.RankingDate, tokenPeakLocation)
		if err != nil {
			continue
		}
		consecutive := currentUserID == day.ChampionUserID && !previousDate.IsZero() && date.Equal(previousDate.AddDate(0, 0, 1))
		if consecutive {
			currentLength++
		} else {
			currentUserID = day.ChampionUserID
			currentName = day.ChampionName
			currentLength = 1
		}
		previousDate = date
		if currentLength > best.StreakDays || (currentLength == best.StreakDays && currentUserID < bestUserID) {
			best = dto.TokenPeakStreakRecord{RankingName: currentName, StreakDays: currentLength}
			bestUserID = currentUserID
		}
	}
	return best
}

func StartTokenPeakSettlementTask() {
	tokenPeakSettlementOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), "token peak settlement task started")
			ticker := time.NewTicker(tokenPeakSettlementTick)
			defer ticker.Stop()
			runTokenPeakSettlementOnce(time.Now())
			for now := range ticker.C {
				runTokenPeakSettlementOnce(now)
			}
		})
	})
}

func runTokenPeakSettlementOnce(now time.Time) {
	if !tokenPeakSettlementBusy.CompareAndSwap(false, true) {
		return
	}
	defer tokenPeakSettlementBusy.Store(false)

	setting := operation_setting.GetTokenPeakSetting()
	if !setting.Enabled {
		return
	}
	todayStart, _ := tokenPeakDayRange(now)
	settlementTime := todayStart.Add(time.Duration(tokenPeakSettlementHour)*time.Hour + time.Duration(tokenPeakSettlementMinute)*time.Minute)
	if now.Before(settlementTime) {
		return
	}
	dayStart := todayStart.AddDate(0, 0, -1)
	dayEnd := todayStart
	if setting.StartedAt > 0 {
		activityStart, _ := tokenPeakDayRange(time.Unix(setting.StartedAt, 0))
		if dayStart.Before(activityStart) {
			return
		}
	}

	rankings, err := model.GetTokenRankingTotals(dayStart.Unix(), dayEnd.Unix(), setting.RewardCount)
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("token peak ranking query failed: %v", err))
		return
	}
	day := model.TokenRankingDay{
		RankingDate: dayStart.Format("2006-01-02"),
		RewardCount: setting.RewardCount,
		SettledAt:   now.Unix(),
	}
	if len(rankings) > 0 {
		day.ChampionUserID = rankings[0].UserID
		day.ChampionName = rankings[0].RankingName
		day.ChampionTokens = rankings[0].TotalTokens
	}
	entries := make([]model.TokenRankingSettlementEntry, 0, len(rankings))
	for index, ranking := range rankings {
		position := index + 1
		if position > len(setting.Rewards) {
			break
		}
		entries = append(entries, model.TokenRankingSettlementEntry{
			Position:    position,
			UserID:      ranking.UserID,
			RankingName: ranking.RankingName,
			TotalTokens: ranking.TotalTokens,
			RewardQuota: setting.Rewards[position-1].RewardQuota,
		})
	}
	created, awards, err := model.SettleTokenRankingDay(day, entries)
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("token peak settlement failed for %s: %v", day.RankingDate, err))
		return
	}
	if !created {
		return
	}
	for _, award := range awards {
		if err := model.InvalidateUserCache(award.UserID); err != nil {
			logger.LogWarn(context.Background(), fmt.Sprintf("token peak user cache invalidation failed for user %d: %v", award.UserID, err))
		}
		if award.AwardedQuota > 0 {
			model.RecordLog(award.UserID, model.LogTypeSystem, fmt.Sprintf("Token Peak position %d reward: %s", award.Position, logger.LogQuota(award.AwardedQuota)))
		}
	}
	logger.LogInfo(context.Background(), fmt.Sprintf("token peak settlement completed for %s: rankings=%d rewards=%d", day.RankingDate, len(rankings), len(awards)))
}

func tokenPeakDayRange(now time.Time) (time.Time, time.Time) {
	local := now.In(tokenPeakLocation)
	start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, tokenPeakLocation)
	return start, start.AddDate(0, 0, 1)
}

func nextTokenPeakSettlement(now time.Time) time.Time {
	start, _ := tokenPeakDayRange(now)
	settlement := start.Add(time.Duration(tokenPeakSettlementHour)*time.Hour + time.Duration(tokenPeakSettlementMinute)*time.Minute)
	if !now.Before(settlement) {
		settlement = settlement.AddDate(0, 0, 1)
	}
	return settlement
}
