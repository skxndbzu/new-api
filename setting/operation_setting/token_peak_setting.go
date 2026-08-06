package operation_setting

import (
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/setting/config"
)

const MaxTokenPeakRewardCount = 10

type TokenPeakReward struct {
	Position    int `json:"position"`
	RewardQuota int `json:"reward_quota"`
}

type TokenPeakSetting struct {
	Enabled     bool              `json:"enabled"`
	RewardCount int               `json:"reward_count"`
	Rewards     []TokenPeakReward `json:"rewards"`
	StartedAt   int64             `json:"started_at"`
}

var tokenPeakSetting = TokenPeakSetting{
	Enabled:     false,
	RewardCount: 3,
	Rewards: []TokenPeakReward{
		{Position: 1, RewardQuota: 10000},
		{Position: 2, RewardQuota: 5000},
		{Position: 3, RewardQuota: 3000},
	},
}

func init() {
	config.GlobalConfig.Register("token_peak_setting", &tokenPeakSetting)
}

func GetTokenPeakSetting() TokenPeakSetting {
	setting := tokenPeakSetting
	setting.Rewards = append([]TokenPeakReward(nil), tokenPeakSetting.Rewards...)
	return setting
}

func ValidateTokenPeakSetting(setting TokenPeakSetting) error {
	if setting.RewardCount < 1 || setting.RewardCount > MaxTokenPeakRewardCount {
		return fmt.Errorf("reward_count must be between 1 and %d", MaxTokenPeakRewardCount)
	}
	if len(setting.Rewards) != setting.RewardCount {
		return fmt.Errorf("rewards must contain exactly %d entries", setting.RewardCount)
	}
	for index, reward := range setting.Rewards {
		expectedPosition := index + 1
		if reward.Position != expectedPosition {
			return fmt.Errorf("reward position %d is missing or out of order", expectedPosition)
		}
		if reward.RewardQuota < 0 || int64(reward.RewardQuota) > math.MaxInt32 {
			return fmt.Errorf("reward quota for position %d is out of range", reward.Position)
		}
	}
	return nil
}
