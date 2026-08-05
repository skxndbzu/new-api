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
import { CrownIcon, RankingIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { TokenPeakRankingEntry } from '../types'
import { AnimatedTokenNumber } from './animated-token-number'
import { SectionHeading } from './section-heading'

type LeaderboardSectionProps = {
  rankings: TokenPeakRankingEntry[]
}

const podiumClasses: Record<number, string> = {
  1: 'border-[oklch(0.76_0.13_78/0.45)] bg-[linear-gradient(120deg,oklch(0.94_0.05_80/0.9),var(--card)_62%)] sm:col-span-2',
  2: 'border-[oklch(0.72_0.02_250/0.45)] bg-[linear-gradient(120deg,oklch(0.94_0.015_250/0.8),var(--card)_68%)]',
  3: 'border-[oklch(0.65_0.08_55/0.4)] bg-[linear-gradient(120deg,oklch(0.92_0.035_55/0.75),var(--card)_68%)]',
}

export function LeaderboardSection(props: LeaderboardSectionProps) {
  const { t } = useTranslation()

  return (
    <section className='flex flex-col gap-4'>
      <SectionHeading
        title={t("Today's leaderboard")}
        description={t("Top 10 based on today's recorded Token usage.")}
        action={
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            <span className='bg-primary size-1.5 rounded-full' aria-hidden />
            {t('Updated about every 5 minutes')}
          </div>
        }
      />

      {props.rankings.length === 0 ? (
        <Empty className='bg-card min-h-56 border'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <HugeiconsIcon icon={RankingIcon} />
            </EmptyMedia>
            <EmptyTitle>{t('No Token usage recorded today')}</EmptyTitle>
            <EmptyDescription>
              {t('The first contender has not arrived yet.')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          {props.rankings.map((entry, index) => (
            <LeaderboardRow
              key={`${entry.position}-${entry.ranking_name}`}
              entry={entry}
              index={index}
              rewardQuota={entry.reward_quota}
            />
          ))}
        </ol>
      )}
    </section>
  )
}

function LeaderboardRow(props: {
  entry: TokenPeakRankingEntry
  index: number
  rewardQuota?: number | null
}) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const podium = props.entry.position <= 3

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(props.index, 9) * 0.035 }}
      className={cn(
        'bg-card ring-foreground/10 min-w-0 rounded-xl border px-4 py-3.5 shadow-sm ring-1',
        podium ? podiumClasses[props.entry.position] : 'sm:col-span-2'
      )}
    >
      <div className='flex min-w-0 items-center gap-3'>
        <div
          className={cn(
            'bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums',
            props.entry.position === 1 &&
              'bg-[oklch(0.82_0.14_82/0.2)] text-[oklch(0.52_0.14_70)]'
          )}
        >
          {props.entry.position === 1 ? (
            <motion.div
              animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <HugeiconsIcon icon={CrownIcon} className='size-5' />
            </motion.div>
          ) : (
            props.entry.position
          )}
        </div>

        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 items-center gap-2'>
            {props.entry.position === 1 && (
              <Badge variant='warning'>{t('CHAMPION')}</Badge>
            )}
            <p className='truncate text-sm font-semibold'>
              {props.entry.ranking_name}
            </p>
          </div>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t('Position {{position}}', { position: props.entry.position })}
          </p>
        </div>

        <div className='min-w-0 shrink-0 text-right'>
          <AnimatedTokenNumber
            value={props.entry.total_tokens}
            className='block text-sm font-semibold tabular-nums sm:text-base'
          />
          <p className='text-muted-foreground text-[11px]'>Token</p>
          {props.rewardQuota != null && (
            <p className='text-primary mt-1 text-xs font-medium tabular-nums'>
              {formatQuota(props.rewardQuota)}
            </p>
          )}
        </div>
      </div>
    </motion.li>
  )
}
