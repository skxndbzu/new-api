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
import { Award02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { formatQuota } from '@/lib/format'

import type { TokenPeakReward } from '../types'
import { SectionHeading } from './section-heading'

type RewardsSectionProps = {
  rewards: TokenPeakReward[]
}

export function RewardsSection(props: RewardsSectionProps) {
  const { t } = useTranslation()

  if (props.rewards.length === 0) return null

  return (
    <section className='flex flex-col gap-4'>
      <SectionHeading
        title={t('Daily rewards')}
        description={t('Finish in a reward position when the day settles.')}
      />
      <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-5'>
        {props.rewards.map((reward) => (
          <div
            key={reward.position}
            className='bg-card ring-foreground/10 flex min-w-0 items-center gap-3 rounded-xl px-4 py-3 ring-1'
          >
            <div className='bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg'>
              <HugeiconsIcon icon={Award02Icon} className='size-4' />
            </div>
            <div className='min-w-0'>
              <p className='text-muted-foreground text-xs'>
                {t('Position {{position}}', { position: reward.position })}
              </p>
              <p className='truncate text-sm font-semibold tabular-nums'>
                {formatQuota(reward.reward_quota)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
