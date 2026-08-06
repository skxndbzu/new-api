package operation_setting

import (
	"math"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateTokenPeakSettingAcceptsSequentialRewards(t *testing.T) {
	setting := TokenPeakSetting{
		RewardCount: 2,
		Rewards: []TokenPeakReward{
			{Position: 1, RewardQuota: 10000},
			{Position: 2, RewardQuota: 5000},
		},
	}
	require.NoError(t, ValidateTokenPeakSetting(setting))
}

func TestValidateTokenPeakSettingRejectsInvalidRewardShape(t *testing.T) {
	tests := []struct {
		name    string
		setting TokenPeakSetting
	}{
		{
			name: "too many positions",
			setting: TokenPeakSetting{
				RewardCount: MaxTokenPeakRewardCount + 1,
			},
		},
		{
			name: "missing position",
			setting: TokenPeakSetting{
				RewardCount: 2,
				Rewards: []TokenPeakReward{
					{Position: 1, RewardQuota: 10000},
				},
			},
		},
		{
			name: "out of order position",
			setting: TokenPeakSetting{
				RewardCount: 2,
				Rewards: []TokenPeakReward{
					{Position: 1, RewardQuota: 10000},
					{Position: 3, RewardQuota: 5000},
				},
			},
		},
		{
			name: "negative quota",
			setting: TokenPeakSetting{
				RewardCount: 1,
				Rewards: []TokenPeakReward{
					{Position: 1, RewardQuota: -1},
				},
			},
		},
		{
			name: "quota exceeds database range",
			setting: TokenPeakSetting{
				RewardCount: 1,
				Rewards: []TokenPeakReward{
					{Position: 1, RewardQuota: int(int64(math.MaxInt32) + 1)},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			require.Error(t, ValidateTokenPeakSetting(test.setting))
		})
	}
}
