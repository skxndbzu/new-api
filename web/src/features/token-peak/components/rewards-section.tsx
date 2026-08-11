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

import { Badge } from '@/components/ui/badge'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { TokenPeakReward } from '../types'
import { SectionHeading } from './section-heading'

type RewardsSectionProps = {
  rewards: TokenPeakReward[]
}

const rewardStyles: Record<number, string> = {
  1: 'border-amber-400/35 bg-[linear-gradient(145deg,var(--card),oklch(0.82_0.15_80/0.16))] shadow-amber-500/10',
  2: 'border-slate-400/25 bg-[linear-gradient(145deg,var(--card),oklch(0.75_0.02_250/0.14))]',
  3: 'border-orange-500/25 bg-[linear-gradient(145deg,var(--card),oklch(0.65_0.12_50/0.12))]',
}
const rewardIcons = {
  1: MedalFirstPlaceIcon,
  2: MedalSecondPlaceIcon,
  3: MedalThirdPlaceIcon,
}

export function RewardsSection(props: RewardsSectionProps) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const featuredRewards = props.rewards.filter((reward) => reward.position <= 3)
  const remainingRewards = props.rewards.filter((reward) => reward.position > 3)

  if (props.rewards.length === 0) return null

  return (
    <section className='flex flex-col gap-4'>
      <SectionHeading
        title={t('Daily rewards')}
        description={t('Finish in a reward position when the day settles.')}
        action={<Badge variant='warning'>{t('Reward zone')}</Badge>}
      />

      {featuredRewards.length > 0 && (
        <div className='grid gap-3 sm:grid-cols-3'>
          {featuredRewards.map((reward, index) => {
            const rewardIcon = rewardIcons[reward.position as 1 | 2 | 3]
            return (
              <motion.div
                key={reward.position}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={reduceMotion ? undefined : { y: -4 }}
                transition={{ duration: 0.35, delay: index * 0.06 }}
                className={cn(
                  'relative min-w-0 overflow-hidden rounded-lg border p-5 shadow-lg',
                  rewardStyles[reward.position]
                )}
              >
                <span
                  aria-hidden
                  className='text-foreground/4 absolute -right-2 -bottom-8 text-8xl font-black tabular-nums'
                >
                  {reward.position}
                </span>
                <div className='relative flex items-start justify-between gap-3'>
                  <div
                    className={cn(
                      'flex size-11 items-center justify-center rounded-md',
                      reward.position === 1 &&
                        'bg-amber-400/15 text-amber-600 dark:text-amber-300',
                      reward.position === 2 &&
                        'bg-slate-400/15 text-slate-600 dark:text-slate-300',
                      reward.position === 3 &&
                        'bg-orange-500/15 text-orange-700 dark:text-orange-300'
                    )}
                  >
                    <HugeiconsIcon icon={rewardIcon} className='size-6' />
                  </div>
                  {reward.position === 1 && (
                    <Badge variant='warning'>{t('Highest reward')}</Badge>
                  )}
                </div>
                <p className='text-muted-foreground relative mt-5 text-xs font-medium'>
                  {t('Position {{position}}', { position: reward.position })}
                </p>
                <p className='relative mt-1 truncate text-2xl font-bold tabular-nums sm:text-3xl'>
                  {formatQuota(reward.reward_quota)}
                </p>
              </motion.div>
            )
          })}
        </div>
      )}

      {remainingRewards.length > 0 && (
        <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
          {remainingRewards.map((reward, index) => (
            <motion.div
              key={reward.position}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.035 }}
              className='bg-card flex min-w-0 items-center gap-3 rounded-lg border px-4 py-3 shadow-sm'
            >
              <div className='bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md'>
                <HugeiconsIcon icon={Award02Icon} className='size-5' />
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
          ))}
        </div>
      )}
    </section>
  )
}
