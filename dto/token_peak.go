package dto

type TokenPeakReward struct {
	Position    int `json:"position"`
	RewardQuota int `json:"reward_quota"`
}

type TokenPeakConfig struct {
	Enabled          bool              `json:"enabled"`
	RewardCount      int               `json:"reward_count"`
	Rewards          []TokenPeakReward `json:"rewards"`
	NextSettlementAt int64             `json:"next_settlement_at"`
}

type UpdateTokenPeakConfigRequest struct {
	Enabled     bool              `json:"enabled"`
	RewardCount int               `json:"reward_count"`
	Rewards     []TokenPeakReward `json:"rewards"`
}

type TokenPeakRankingEntry struct {
	Position         int    `json:"position"`
	RankingName      string `json:"ranking_name"`
	TotalTokens      int64  `json:"total_tokens"`
	TokensToOvertake *int64 `json:"tokens_to_overtake"`
	RewardQuota      *int   `json:"reward_quota,omitempty"`
}

type TokenPeakUserPerformance struct {
	CurrentPosition      *int   `json:"current_position"`
	TotalTokens          int64  `json:"total_tokens"`
	EstimatedRewardQuota *int   `json:"estimated_reward_quota"`
	RewardPosition       *int   `json:"reward_position"`
	TokensToOvertake     *int64 `json:"tokens_to_overtake"`
	OvertakePosition     *int   `json:"overtake_position"`
	TokensToRank         *int64 `json:"tokens_to_rank"`
	TargetPosition       *int   `json:"target_position"`
}

type TokenPeakToday struct {
	Rankings  []TokenPeakRankingEntry  `json:"rankings"`
	MyRanking TokenPeakUserPerformance `json:"my_ranking"`
	UpdatedAt int64                    `json:"updated_at"`
	Timezone  string                   `json:"timezone"`
}

type TokenPeakHighestDailyRecord struct {
	RankingName    string `json:"ranking_name"`
	ChampionTokens int64  `json:"champion_tokens"`
	Date           string `json:"date"`
}

type TokenPeakChampionshipRecord struct {
	RankingName   string `json:"ranking_name"`
	ChampionCount int64  `json:"champion_count"`
}

type TokenPeakStreakRecord struct {
	RankingName string `json:"ranking_name"`
	StreakDays  int    `json:"streak_days"`
}

type TokenPeakRecords struct {
	HighestDailyTokens TokenPeakHighestDailyRecord `json:"highest_daily_tokens"`
	MostChampionships  TokenPeakChampionshipRecord `json:"most_championships"`
	LongestStreak      TokenPeakStreakRecord       `json:"longest_streak"`
}
