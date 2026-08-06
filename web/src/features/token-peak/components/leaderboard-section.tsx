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
  MedalFirstPlaceIcon,
  MedalSecondPlaceIcon,
  MedalThirdPlaceIcon,
  RankingIcon,
} from '@hugeicons/core-free-icons'
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
import { RankingAvatar } from './ranking-avatar'
import { SectionHeading } from './section-heading'

type LeaderboardSectionProps = {
  rankings: TokenPeakRankingEntry[]
  currentPosition?: number | null
}

const medalIcons = {
  1: MedalFirstPlaceIcon,
  2: MedalSecondPlaceIcon,
  3: MedalThirdPlaceIcon,
}
const leadingRowStyles: Record<number, string> = {
  1: 'border-amber-400/35 bg-amber-400/8',
  2: 'border-slate-400/25 bg-slate-400/8',
  3: 'border-orange-500/25 bg-orange-500/7',
}

export function LeaderboardSection(props: LeaderboardSectionProps) {
  const { t } = useTranslation()

  return (
    <section className='flex flex-col gap-4'>
      <SectionHeading
        title={t('Live challenge leaderboard')}
        description={t("Top 10 based on today's recorded Token usage.")}
        action={
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            <span className='bg-success size-1.5 rounded-full' aria-hidden />
            {t('Updated about every 5 minutes')}
          </div>
        }
      />

      {props.rankings.length === 0 ? (
        <Empty className='bg-card min-h-56 rounded-lg border'>
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
        <ol className='flex flex-col gap-2'>
          {props.rankings.map((entry, index) => (
            <LeaderboardRow
              key={`${entry.position}-${entry.ranking_name}`}
              entry={entry}
              index={index}
              isCurrent={props.currentPosition === entry.position}
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
  isCurrent: boolean
}) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const medalIcon = medalIcons[props.entry.position as 1 | 2 | 3]

  return (
    <motion.li
      aria-current={props.isCurrent ? 'true' : undefined}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { x: 3 }}
      transition={{ duration: 0.32, delay: Math.min(props.index, 9) * 0.035 }}
      className={cn(
        'group bg-card ring-foreground/5 min-w-0 rounded-lg border px-3 py-3 shadow-sm ring-1 transition-[box-shadow,border-color,background-color] hover:shadow-md sm:px-5 sm:py-4',
        leadingRowStyles[props.entry.position],
        props.isCurrent &&
          'border-primary/45 bg-primary/8 ring-primary/15 shadow-primary/10'
      )}
    >
      <div className='flex min-w-0 items-center gap-2.5 sm:gap-4'>
        <div
          className={cn(
            'bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-bold tabular-nums sm:size-11',
            props.entry.position === 1 &&
              'bg-amber-400/15 text-amber-600 dark:text-amber-300',
            props.isCurrent && 'bg-primary text-primary-foreground'
          )}
        >
          {medalIcon ? (
            <HugeiconsIcon icon={medalIcon} className='size-5' />
          ) : (
            props.entry.position
          )}
        </div>

        <RankingAvatar
          name={props.entry.ranking_name}
          className='hidden sm:flex'
        />

        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 items-center gap-2'>
            <p className='truncate text-sm font-semibold sm:text-base'>
              {props.entry.ranking_name}
            </p>
            {props.isCurrent && <Badge className='shrink-0'>{t('You')}</Badge>}
          </div>
          <p className='text-muted-foreground mt-0.5 text-[11px] sm:text-xs'>
            {t('Position {{position}}', { position: props.entry.position })}
          </p>
        </div>

        <div className='min-w-0 shrink-0 text-right'>
          <AnimatedTokenNumber
            value={props.entry.total_tokens}
            className='block text-sm font-bold tabular-nums sm:text-lg'
          />
          <p className='text-muted-foreground text-[10px] sm:text-xs'>Token</p>
        </div>

        <div className='hidden w-28 shrink-0 text-right md:block'>
          {props.entry.reward_quota != null ? (
            <>
              <p className='text-primary text-sm font-semibold tabular-nums'>
                {formatQuota(props.entry.reward_quota)}
              </p>
              <p className='text-muted-foreground mt-0.5 text-xs'>
                {t('Reward secured')}
              </p>
            </>
          ) : (
            <p className='text-muted-foreground text-xs'>
              {t('Keep climbing')}
            </p>
          )}
        </div>
      </div>
    </motion.li>
  )
}
