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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'

import { LeaderboardSection } from './components/leaderboard-section'
import { MyPerformanceCard } from './components/my-performance-card'
import { RecordsSection } from './components/records-section'
import { RewardsSection } from './components/rewards-section'
import { RulesSection } from './components/rules-section'
import { TokenPeakHero } from './components/token-peak-hero'
import {
  TokenPeakClosed,
  TokenPeakLoading,
} from './components/token-peak-states'
import { useTokenPeak } from './hooks/use-token-peak'

export function TokenPeak() {
  const { t } = useTranslation()
  const { configQuery, todayQuery, recordsQuery } = useTokenPeak()
  const config = configQuery.data?.data

  const retry = () => {
    configQuery.refetch()
    if (config?.enabled) {
      todayQuery.refetch()
      recordsQuery.refetch()
    }
  }

  if (configQuery.isLoading) {
    return (
      <TokenPeakPageFrame>
        <TokenPeakLoading />
      </TokenPeakPageFrame>
    )
  }

  if (configQuery.isError || !config) {
    return (
      <TokenPeakPageFrame>
        <ErrorState
          className='bg-card rounded-xl border'
          title={t('Unable to load Token Peak')}
          description={t('Check your connection and try again.')}
          onRetry={retry}
        />
      </TokenPeakPageFrame>
    )
  }

  if (!config.enabled) {
    return (
      <TokenPeakPageFrame>
        <TokenPeakHero enabled={false} />
        <TokenPeakClosed />
        <RulesSection />
      </TokenPeakPageFrame>
    )
  }

  if (todayQuery.isLoading) {
    return (
      <TokenPeakPageFrame>
        <TokenPeakHero enabled nextSettlementAt={config.next_settlement_at} />
        <TokenPeakLoading />
      </TokenPeakPageFrame>
    )
  }

  if (todayQuery.isError || !todayQuery.data?.data) {
    return (
      <TokenPeakPageFrame>
        <TokenPeakHero enabled nextSettlementAt={config.next_settlement_at} />
        <ErrorState
          className='bg-card rounded-xl border'
          title={t("Unable to load today's leaderboard")}
          description={t('Check your connection and try again.')}
          onRetry={retry}
        />
      </TokenPeakPageFrame>
    )
  }

  return (
    <TokenPeakPageFrame>
      <TokenPeakHero enabled nextSettlementAt={config.next_settlement_at} />
      <MyPerformanceCard performance={todayQuery.data.data.my_ranking} />
      <RewardsSection rewards={config.rewards} />
      <LeaderboardSection rankings={todayQuery.data.data.rankings} />
      <RecordsSection records={recordsQuery.data?.data} />
      <RulesSection />
    </TokenPeakPageFrame>
  )
}

function TokenPeakPageFrame(props: { children: ReactNode }) {
  return (
    <Main>
      <div className='min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-4 sm:py-6'>
        <PageTransition className='mx-auto flex w-full max-w-6xl flex-col gap-7 pb-4 sm:gap-9'>
          {props.children}
        </PageTransition>
      </div>
    </Main>
  )
}
