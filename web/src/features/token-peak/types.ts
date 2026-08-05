/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

export type TokenPeakReward = {
  position: number
  reward_quota: number
}

export type TokenPeakConfig = {
  enabled: boolean
  reward_count: number
  rewards: TokenPeakReward[]
  next_settlement_at?: number | string | null
}

export type TokenPeakRankingEntry = {
  position: number
  ranking_name: string
  total_tokens: number
  tokens_to_overtake?: number | null
  reward_quota?: number | null
}

export type TokenPeakUserPerformance = {
  current_position: number | null
  total_tokens: number
  estimated_reward_quota?: number | null
  reward_position?: number | null
  tokens_to_overtake?: number | null
  overtake_position?: number | null
  tokens_to_rank?: number | null
  target_position?: number | null
}

export type TokenPeakToday = {
  rankings: TokenPeakRankingEntry[]
  my_ranking: TokenPeakUserPerformance | null
  updated_at?: number | string | null
  timezone?: string
}

export type TokenPeakRecordHolder = {
  ranking_name: string
  date?: string | null
}

export type TokenPeakRecords = {
  highest_daily_tokens: TokenPeakRecordHolder & {
    champion_tokens: number
  }
  most_championships: TokenPeakRecordHolder & {
    champion_count: number
  }
  longest_streak: TokenPeakRecordHolder & {
    streak_days: number
  }
}

export type TokenPeakResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export type UpdateTokenPeakConfigRequest = Pick<
  TokenPeakConfig,
  'enabled' | 'reward_count' | 'rewards'
>
