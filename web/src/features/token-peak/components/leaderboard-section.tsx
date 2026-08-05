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
  SparklesIcon,
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
import { SectionHeading } from './section-heading'

type LeaderboardSectionProps = {
  rankings: TokenPeakRankingEntry[]
}

const podiumLayoutClasses: Record<number, string> = {
  1: 'sm:col-start-2 sm:row-start-1 sm:min-h-[282px]',
  2: 'sm:col-start-1 sm:row-start-1 sm:min-h-[242px]',
  3: 'sm:col-start-3 sm:row-start-1 sm:min-h-[226px]',
}

const podiumSurfaceClasses: Record<number, string> = {
  1: 'border-warning/50 bg-[linear-gradient(145deg,var(--card),color-mix(in_oklch,var(--warning)_14%,var(--card)))] shadow-warning/10',
  2: 'border-foreground/15 bg-[linear-gradient(145deg,var(--card),var(--muted))]',
  3: 'border-[oklch(0.63_0.09_55/0.4)] bg-[linear-gradient(145deg,var(--card),oklch(0.9_0.035_55/0.45))]',
}

export function LeaderboardSection(props: LeaderboardSectionProps) {
  const { t } = useTranslation()
  const podiumEntries = props.rankings.filter((entry) => entry.position <= 3)
  const remainingEntries = props.rankings.filter((entry) => entry.position > 3)

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
        <div className='flex flex-col gap-4'>
          {podiumEntries.length > 0 && (
            <ol className='grid items-end gap-3 sm:grid-cols-3'>
              {podiumEntries.map((entry, index) => (
                <PodiumCard key={entry.position} entry={entry} index={index} />
              ))}
            </ol>
          )}
          {remainingEntries.length > 0 && (
            <ol className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
              {remainingEntries.map((entry, index) => (
                <LeaderboardRow
                  key={`${entry.position}-${entry.ranking_name}`}
                  entry={entry}
                  index={index + podiumEntries.length}
                  rewardQuota={entry.reward_quota}
                />
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}

function PodiumCard(props: { entry: TokenPeakRankingEntry; index: number }) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  let medalIcon = MedalThirdPlaceIcon
  let label = t('THIRD PLACE')
  let iconClassName = 'bg-[oklch(0.72_0.1_55/0.16)] text-[oklch(0.52_0.1_55)]'

  if (props.entry.position === 1) {
    medalIcon = MedalFirstPlaceIcon
    label = t('CHAMPION')
    iconClassName = 'bg-warning/15 text-warning'
  } else if (props.entry.position === 2) {
    medalIcon = MedalSecondPlaceIcon
    label = t('RUNNER-UP')
    iconClassName = 'bg-foreground/8 text-foreground/70'
  }

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={reduceMotion ? undefined : { y: -6 }}
      transition={{
        duration: 0.45,
        delay: props.index * 0.08,
        ease: 'easeOut',
      }}
      className={cn(
        'relative flex min-h-[218px] min-w-0 flex-col overflow-hidden rounded-lg border px-5 pt-5 shadow-lg',
        podiumLayoutClasses[props.entry.position],
        podiumSurfaceClasses[props.entry.position]
      )}
    >
      {props.entry.position === 1 && (
        <>
          <motion.div
            aria-hidden
            className='text-warning/55 absolute top-5 right-5'
            animate={
              reduceMotion
                ? undefined
                : { scale: [1, 1.18, 1], rotate: [0, 8, 0] }
            }
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <HugeiconsIcon icon={SparklesIcon} className='size-5' />
          </motion.div>
          <motion.div
            aria-hidden
            className='pointer-events-none absolute inset-y-0 w-16 bg-linear-to-r from-transparent via-white/25 to-transparent'
            animate={reduceMotion ? undefined : { x: ['-180%', '650%'] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 3.5 }}
          />
        </>
      )}

      <div className='relative flex items-start justify-between gap-3'>
        <div
          className={cn(
            'flex size-12 items-center justify-center rounded-lg',
            iconClassName
          )}
        >
          <motion.div
            animate={
              props.entry.position === 1 && !reduceMotion
                ? { y: [0, -4, 0], rotate: [0, -4, 0] }
                : undefined
            }
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <HugeiconsIcon icon={medalIcon} className='size-7' aria-hidden />
          </motion.div>
        </div>
        <Badge variant={props.entry.position === 1 ? 'warning' : 'secondary'}>
          {label}
        </Badge>
      </div>

      <div className='relative mt-5 min-w-0 flex-1'>
        <p className='truncate text-base font-semibold'>
          {props.entry.ranking_name}
        </p>
        <AnimatedTokenNumber
          value={props.entry.total_tokens}
          className='mt-2 block text-2xl font-semibold tabular-nums'
        />
        <p className='text-muted-foreground text-xs'>Token</p>
        {props.entry.reward_quota != null && (
          <div className='bg-background/45 text-primary mt-3 inline-flex rounded-md border border-current/10 px-2.5 py-1 text-sm font-semibold tabular-nums'>
            {formatQuota(props.entry.reward_quota)}
          </div>
        )}
      </div>

      <div className='relative mt-4 flex h-12 items-end justify-center border-t border-current/10'>
        <span className='text-foreground/10 text-4xl leading-none font-black tabular-nums'>
          {props.entry.position}
        </span>
      </div>
    </motion.li>
  )
}

function LeaderboardRow(props: {
  entry: TokenPeakRankingEntry
  index: number
  rewardQuota?: number | null
}) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(props.index, 9) * 0.035 }}
      whileHover={reduceMotion ? undefined : { x: 3 }}
      className='group bg-card ring-foreground/10 min-w-0 rounded-lg border px-4 py-3.5 shadow-sm ring-1 transition-shadow hover:shadow-md'
    >
      <div className='flex min-w-0 items-center gap-3'>
        <div
          className={cn(
            'bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums',
            'transition-colors group-hover:bg-primary/10 group-hover:text-primary'
          )}
        >
          {props.entry.position}
        </div>

        <div className='min-w-0 flex-1'>
          <p className='truncate text-sm font-semibold'>
            {props.entry.ranking_name}
          </p>
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
