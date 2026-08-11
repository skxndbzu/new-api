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
  Award01Icon,
  RacingFlagIcon,
  Target02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress'
import { formatQuota } from '@/lib/format'

import type { TokenPeakUserPerformance } from '../types'
import { AnimatedTokenNumber } from './animated-token-number'
import { SectionHeading } from './section-heading'

type MyPerformanceCardProps = {
  performance: TokenPeakUserPerformance | null
}

export function MyPerformanceCard(props: MyPerformanceCardProps) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const performance = props.performance
  const position = performance?.current_position
  const isRanked = position != null
  const gap = performance?.tokens_to_overtake ?? performance?.tokens_to_rank
  const totalTokens = performance?.total_tokens ?? 0
  let progress = 0

  if (gap != null && totalTokens + gap > 0) {
    progress = Math.round((totalTokens / (totalTokens + gap)) * 100)
  } else if (isRanked) {
    progress = 100
  }
  progress = Math.min(100, Math.max(0, progress))

  return (
    <section className='flex flex-col gap-4'>
      <SectionHeading
        title={t('My climb progress')}
        description={t('Every request moves you closer to the next position.')}
        action={
          <Badge variant={isRanked ? 'default' : 'secondary'}>
            <HugeiconsIcon icon={RacingFlagIcon} />
            {isRanked ? t('On the board') : t('Keep pushing')}
          </Badge>
        }
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className='border-primary/15 bg-card relative overflow-hidden rounded-lg border shadow-[0_16px_45px_-34px_var(--primary)]'
      >
        <div aria-hidden className='bg-primary absolute inset-y-0 left-0 w-1' />
        <div className='grid sm:grid-cols-[0.8fr_1fr_1fr]'>
          <div className='bg-primary/5 px-5 py-5 sm:px-6 sm:py-6'>
            <p className='text-muted-foreground text-xs font-medium'>
              {t('Current position')}
            </p>
            <div className='mt-2 text-3xl font-bold tracking-normal tabular-nums sm:text-4xl'>
              {isRanked ? `NO.${position}` : t('Not ranked yet')}
            </div>
            <p className='text-muted-foreground mt-2 text-xs'>
              {isRanked
                ? t('Hold your ground before settlement.')
                : t('Your next request could put you on the board.')}
            </p>
          </div>

          <div className='border-t px-5 py-5 sm:border-t-0 sm:border-l sm:px-6 sm:py-6'>
            <p className='text-muted-foreground text-xs font-medium'>
              {t('Tokens used today')}
            </p>
            <AnimatedTokenNumber
              value={totalTokens}
              className='mt-2 block text-2xl font-bold tabular-nums sm:text-3xl'
            />
            <p className='text-muted-foreground mt-1 text-xs'>Token</p>
          </div>

          <div className='border-t px-5 py-5 sm:border-t-0 sm:border-l sm:px-6 sm:py-6'>
            <p className='text-muted-foreground text-xs font-medium'>
              {t('Estimated reward')}
            </p>
            <div className='mt-2 flex min-w-0 items-center gap-2'>
              <div className='bg-warning/12 text-warning flex size-9 shrink-0 items-center justify-center rounded-md'>
                <HugeiconsIcon icon={Award01Icon} className='size-5' />
              </div>
              <span className='truncate text-2xl font-bold tabular-nums sm:text-3xl'>
                {performance?.estimated_reward_quota != null
                  ? formatQuota(performance.estimated_reward_quota)
                  : t('No reward yet')}
              </span>
            </div>
            {performance?.reward_position != null && (
              <p className='text-muted-foreground mt-2 text-xs'>
                {t('Reward for position {{position}}', {
                  position: performance.reward_position,
                })}
              </p>
            )}
          </div>
        </div>

        <div className='border-t px-5 py-5 sm:px-6'>
          <div className='mb-4 flex items-start gap-3'>
            <div className='bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md'>
              <HugeiconsIcon icon={Target02Icon} className='size-5' />
            </div>
            <NextTarget performance={performance} />
          </div>
          <Progress
            value={progress}
            className='gap-2 [&_[data-slot=progress-indicator]]:bg-[linear-gradient(to_right,var(--primary),var(--warning))] [&_[data-slot=progress-track]]:h-2.5'
          >
            <ProgressLabel>{t('Challenge progress')}</ProgressLabel>
            <ProgressValue />
          </Progress>
        </div>
      </motion.div>
    </section>
  )
}

function NextTarget(props: { performance: TokenPeakUserPerformance | null }) {
  const { t } = useTranslation()
  const performance = props.performance

  if (performance?.tokens_to_overtake != null) {
    const label =
      performance.overtake_position != null
        ? t('To overtake position {{position}}', {
            position: performance.overtake_position,
          })
        : t('Distance to the next position')
    return (
      <div className='min-w-0'>
        <p className='text-sm font-medium'>{label}</p>
        <AnimatedTokenNumber
          value={performance.tokens_to_overtake}
          suffix={` ${t('Token')}`}
          className='text-primary mt-0.5 block text-lg font-bold tabular-nums'
        />
      </div>
    )
  }

  if (performance?.tokens_to_rank != null) {
    return (
      <div className='min-w-0'>
        <p className='text-sm font-medium'>{t('Distance to Top 10')}</p>
        <AnimatedTokenNumber
          value={performance.tokens_to_rank}
          suffix={` ${t('Token')}`}
          className='text-primary mt-0.5 block text-lg font-bold tabular-nums'
        />
      </div>
    )
  }

  return (
    <div className='min-w-0'>
      <p className='text-sm font-medium'>{t('Next target')}</p>
      <p className='text-muted-foreground mt-0.5 text-sm'>
        {t('Keep using the API to unlock your next challenge.')}
      </p>
    </div>
  )
}
