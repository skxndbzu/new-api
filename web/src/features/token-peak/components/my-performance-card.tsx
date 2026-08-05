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
import { Award01Icon, Target02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatQuota } from '@/lib/format'

import type { TokenPeakUserPerformance } from '../types'
import { AnimatedTokenNumber } from './animated-token-number'

type MyPerformanceCardProps = {
  performance: TokenPeakUserPerformance | null
}

export function MyPerformanceCard(props: MyPerformanceCardProps) {
  const { t } = useTranslation()
  const performance = props.performance
  const position = performance?.current_position
  const isRanked = position != null

  return (
    <Card className='border-primary/10 bg-card/90 shadow-sm backdrop-blur-sm'>
      <CardHeader className='border-b'>
        <div>
          <CardTitle>{t('My performance today')}</CardTitle>
          <CardDescription>
            {t('Every request moves you closer to the next position.')}
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant={isRanked ? 'default' : 'secondary'}>
            {isRanked ? t('On the board') : t('Keep pushing')}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className='grid gap-0 px-0 sm:grid-cols-3'>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className='px-5 py-5 sm:border-r sm:px-6'
        >
          <p className='text-muted-foreground text-xs font-medium'>
            {t('Current position')}
          </p>
          <div className='mt-2 text-3xl font-semibold tracking-normal tabular-nums'>
            {isRanked ? `NO.${position}` : t('Not ranked yet')}
          </div>
          <p className='text-muted-foreground mt-2 text-xs'>
            {isRanked
              ? t('Hold your ground before settlement.')
              : t('Your next request could put you on the board.')}
          </p>
        </motion.div>

        <div className='border-t px-5 py-5 sm:border-t-0 sm:border-r sm:px-6'>
          <p className='text-muted-foreground text-xs font-medium'>
            {t('Tokens used today')}
          </p>
          <AnimatedTokenNumber
            value={performance?.total_tokens ?? 0}
            className='mt-2 block text-2xl font-semibold tabular-nums'
          />
          <p className='text-muted-foreground mt-2 text-xs'>Token</p>
        </div>

        <div className='border-t px-5 py-5 sm:border-t-0 sm:px-6'>
          <p className='text-muted-foreground text-xs font-medium'>
            {t('Estimated reward')}
          </p>
          <div className='mt-2 flex items-center gap-2'>
            <HugeiconsIcon icon={Award01Icon} className='text-primary size-5' />
            <span className='text-2xl font-semibold tabular-nums'>
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
      </CardContent>

      <div className='bg-muted/30 border-t px-5 py-4 sm:px-6'>
        <div className='flex items-start gap-3'>
          <div className='bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg'>
            <HugeiconsIcon icon={Target02Icon} className='size-4' />
          </div>
          <NextTarget performance={performance} />
        </div>
      </div>
    </Card>
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
          className='text-primary mt-0.5 block text-lg font-semibold tabular-nums'
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
          className='text-primary mt-0.5 block text-lg font-semibold tabular-nums'
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
