package model

import (
	"errors"
	"math"

	"gorm.io/gorm"
)

type TokenRankingDay struct {
	Id             int    `json:"id" gorm:"primaryKey;autoIncrement"`
	RankingDate    string `json:"ranking_date" gorm:"type:varchar(10);not null;uniqueIndex"`
	ChampionUserID int    `json:"champion_user_id" gorm:"not null;index"`
	ChampionName   string `json:"champion_name" gorm:"type:varchar(64);not null"`
	ChampionTokens int64  `json:"champion_tokens" gorm:"type:bigint;not null"`
	RewardCount    int    `json:"reward_count" gorm:"not null"`
	SettledAt      int64  `json:"settled_at" gorm:"type:bigint;not null"`
}

func (TokenRankingDay) TableName() string {
	return "token_ranking_days"
}

type TokenRankingReward struct {
	Id              int    `json:"id" gorm:"primaryKey;autoIncrement"`
	RankingDate     string `json:"ranking_date" gorm:"type:varchar(10);not null;uniqueIndex:idx_token_ranking_reward_day_position;uniqueIndex:idx_token_ranking_reward_day_user"`
	Position        int    `json:"position" gorm:"not null;uniqueIndex:idx_token_ranking_reward_day_position"`
	UserID          int    `json:"user_id" gorm:"not null;index;uniqueIndex:idx_token_ranking_reward_day_user"`
	RankingName     string `json:"ranking_name" gorm:"type:varchar(64);not null"`
	TotalTokens     int64  `json:"total_tokens" gorm:"type:bigint;not null"`
	ConfiguredQuota int    `json:"configured_quota" gorm:"not null"`
	AwardedQuota    int    `json:"awarded_quota" gorm:"not null"`
	CreatedAt       int64  `json:"created_at" gorm:"type:bigint;not null"`
}

func (TokenRankingReward) TableName() string {
	return "token_ranking_rewards"
}

type TokenRankingTotal struct {
	UserID      int    `json:"user_id"`
	RankingName string `json:"ranking_name"`
	TotalTokens int64  `json:"total_tokens"`
}

type TokenRankingSettlementEntry struct {
	Position    int
	UserID      int
	RankingName string
	TotalTokens int64
	RewardQuota int
}

type TokenRankingAward struct {
	UserID       int
	Position     int
	AwardedQuota int
}

type TokenRankingChampionCount struct {
	ChampionUserID int    `json:"champion_user_id"`
	ChampionName   string `json:"champion_name"`
	ChampionCount  int64  `json:"champion_count"`
}

func GetTokenRankingTotals(startTime, endTime int64, limit int) ([]TokenRankingTotal, error) {
	rows := make([]TokenRankingTotal, 0)
	query := DB.Table("quota_data").
		Select("user_id, MAX(username) AS ranking_name, SUM(token_used) AS total_tokens").
		Where("created_at >= ? AND created_at < ? AND user_id > 0", startTime, endTime).
		Group("user_id").
		Having("SUM(token_used) > 0").
		Order("total_tokens DESC").
		Order("user_id ASC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	err := query.Find(&rows).Error
	return rows, err
}

func GetTokenRankingUserTotal(userID int, startTime, endTime int64) (TokenRankingTotal, error) {
	var row TokenRankingTotal
	err := DB.Table("quota_data").
		Select("user_id, MAX(username) AS ranking_name, COALESCE(SUM(token_used), 0) AS total_tokens").
		Where("user_id = ? AND created_at >= ? AND created_at < ?", userID, startTime, endTime).
		Group("user_id").
		Scan(&row).Error
	return row, err
}

func CountTokenRankingUsersAhead(userID int, totalTokens, startTime, endTime int64) (int64, error) {
	totals := DB.Table("quota_data").
		Select("user_id, SUM(token_used) AS total_tokens").
		Where("created_at >= ? AND created_at < ? AND user_id > 0", startTime, endTime).
		Group("user_id").
		Having("SUM(token_used) > 0")
	var count int64
	err := DB.Table("(?) AS token_ranking_totals", totals).
		Where("total_tokens > ? OR (total_tokens = ? AND user_id < ?)", totalTokens, totalTokens, userID).
		Count(&count).Error
	return count, err
}

func SettleTokenRankingDay(day TokenRankingDay, entries []TokenRankingSettlementEntry) (bool, []TokenRankingAward, error) {
	awards := make([]TokenRankingAward, 0, len(entries))
	created := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		storedDay := TokenRankingDay{}
		result := tx.Where("ranking_date = ?", day.RankingDate).Attrs(day).FirstOrCreate(&storedDay)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}
		created = true

		for _, entry := range entries {
			if entry.RewardQuota < 0 {
				return errors.New("token ranking reward quota cannot be negative")
			}
			record := TokenRankingReward{
				RankingDate:     day.RankingDate,
				Position:        entry.Position,
				UserID:          entry.UserID,
				RankingName:     entry.RankingName,
				TotalTokens:     entry.TotalTokens,
				ConfiguredQuota: entry.RewardQuota,
				CreatedAt:       day.SettledAt,
			}

			var user User
			err := lockForUpdate(tx).Select("id", "quota").Where("id = ?", entry.UserID).First(&user).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				if err := tx.Create(&record).Error; err != nil {
					return err
				}
				continue
			}
			if err != nil {
				return err
			}

			newQuota := int64(user.Quota)
			if newQuota < math.MaxInt32 {
				newQuota += int64(entry.RewardQuota)
				if newQuota > math.MaxInt32 {
					newQuota = math.MaxInt32
				}
			}
			record.AwardedQuota = int(newQuota) - user.Quota
			if err := tx.Model(&User{}).Where("id = ?", entry.UserID).Update("quota", int(newQuota)).Error; err != nil {
				return err
			}
			if err := tx.Create(&record).Error; err != nil {
				return err
			}
			awards = append(awards, TokenRankingAward{
				UserID:       entry.UserID,
				Position:     entry.Position,
				AwardedQuota: record.AwardedQuota,
			})
		}
		return nil
	})
	if err != nil {
		return false, nil, err
	}
	return created, awards, nil
}

func GetHighestTokenRankingDay() (*TokenRankingDay, error) {
	var day TokenRankingDay
	result := DB.Where("champion_user_id > 0").
		Order("champion_tokens DESC").
		Order("ranking_date ASC").
		Limit(1).
		Find(&day)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, nil
	}
	return &day, nil
}

func GetMostTokenRankingChampionships() (*TokenRankingChampionCount, error) {
	var record TokenRankingChampionCount
	result := DB.Model(&TokenRankingDay{}).
		Select("champion_user_id, MAX(champion_name) AS champion_name, COUNT(*) AS champion_count").
		Where("champion_user_id > 0").
		Group("champion_user_id").
		Order("champion_count DESC").
		Order("champion_user_id ASC").
		Limit(1).
		Find(&record)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, nil
	}
	return &record, nil
}

func ListTokenRankingChampionDays() ([]TokenRankingDay, error) {
	days := make([]TokenRankingDay, 0)
	err := DB.Where("champion_user_id > 0").Order("ranking_date ASC").Find(&days).Error
	return days, err
}
