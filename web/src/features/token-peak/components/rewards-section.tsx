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
import {
  Award02Icon,
  MedalFirstPlaceIcon,
  MedalSecondPlaceIcon,
  MedalThirdPlaceIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { TokenPeakReward } from '../types'
import { SectionHeading } from './section-heading'

type RewardsSectionProps = {
  rewards: TokenPeakReward[]
}

export function RewardsSection(props: RewardsSectionProps) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()

  if (props.rewards.length === 0) return null

  return (
    <section className='flex flex-col gap-4'>
      <SectionHeading
        title={t('Daily rewards')}
        description={t('Finish in a reward position when the day settles.')}
      />
      <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-5'>
        {props.rewards.map((reward, index) => {
          let rewardIcon = Award02Icon
          let iconClassName = 'bg-primary/10 text-primary'
          if (reward.position === 1) {
            rewardIcon = MedalFirstPlaceIcon
            iconClassName = 'bg-warning/15 text-warning'
          } else if (reward.position === 2) {
            rewardIcon = MedalSecondPlaceIcon
            iconClassName = 'bg-foreground/8 text-foreground/70'
          } else if (reward.position === 3) {
            rewardIcon = MedalThirdPlaceIcon
            iconClassName =
              'bg-[oklch(0.72_0.1_55/0.16)] text-[oklch(0.52_0.1_55)]'
          }

          return (
            <motion.div
              key={reward.position}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={reduceMotion ? undefined : { y: -3 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className='bg-card ring-foreground/10 flex min-w-0 items-center gap-3 rounded-lg px-4 py-3 shadow-sm ring-1'
            >
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                  iconClassName
                )}
              >
                <HugeiconsIcon icon={rewardIcon} className='size-5' />
              </div>
              <div className='min-w-0'>
                <p className='text-muted-foreground text-xs'>
                  {t('Position {{position}}', { position: reward.position })}
                </p>
                <p className='truncate text-sm font-semibold tabular-nums'>
                  {formatQuota(reward.reward_quota)}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
