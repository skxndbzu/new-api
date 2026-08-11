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
  CrownIcon,
  MedalFirstPlaceIcon,
  MedalSecondPlaceIcon,
  MedalThirdPlaceIcon,
  SparklesIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { TokenPeakRankingEntry } from '../types'
import { AnimatedTokenNumber } from './animated-token-number'
import { RankingAvatar } from './ranking-avatar'
import { SectionHeading } from './section-heading'

type GloryPodiumProps = {
  rankings: TokenPeakRankingEntry[]
}

const podiumSlots = [2, 1, 3]
const podiumStyles: Record<number, string> = {
  1: 'order-1 min-h-56 border-amber-400/40 bg-[linear-gradient(155deg,oklch(0.24_0.055_80),oklch(0.14_0.025_230))] text-white shadow-[0_18px_45px_-24px_oklch(0.72_0.15_80)] sm:order-2 sm:min-h-72',
  2: 'order-2 min-h-44 border-slate-300/40 bg-[linear-gradient(155deg,oklch(0.3_0.025_240),oklch(0.16_0.025_230))] text-white sm:order-1 sm:min-h-60',
  3: 'order-3 min-h-40 border-orange-500/35 bg-[linear-gradient(155deg,oklch(0.31_0.07_48),oklch(0.15_0.025_230))] text-white sm:min-h-52',
}
const avatarStyles: Record<number, string> = {
  1: 'size-16 ring-4 ring-amber-300/35 sm:size-20',
  2: 'size-12 ring-4 ring-slate-200/25 sm:size-16',
  3: 'size-11 ring-4 ring-orange-300/20 sm:size-14',
}
const iconByPosition = {
  1: MedalFirstPlaceIcon,
  2: MedalSecondPlaceIcon,
  3: MedalThirdPlaceIcon,
}

export function GloryPodium(props: GloryPodiumProps) {
  const { t } = useTranslation()

  return (
    <section className='flex flex-col gap-4'>
      <SectionHeading
        title={t("Today's Hall of Glory")}
        description={t('Only the strongest contenders stand on the podium.')}
      />
      <ol className='grid grid-cols-3 items-end gap-1.5 sm:gap-3'>
        {podiumSlots.map((position, index) => (
          <PodiumSlot
            key={position}
            position={position}
            entry={props.rankings.find((item) => item.position === position)}
            index={index}
          />
        ))}
      </ol>
    </section>
  )
}

function PodiumSlot(props: {
  position: number
  entry?: TokenPeakRankingEntry
  index: number
}) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const isChampion = props.position === 1
  const medalIcon = iconByPosition[props.position as 1 | 2 | 3]
  const name = props.entry?.ranking_name ?? t('Waiting for challenger')

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -5 }}
      transition={{
        duration: 0.45,
        delay: props.index * 0.07,
        ease: 'easeOut',
      }}
      className={cn(
        'relative flex min-w-0 flex-col items-center overflow-hidden rounded-lg border px-2 py-4 text-center shadow-xl sm:px-4 sm:py-6',
        podiumStyles[props.position]
      )}
    >
      <div
        aria-hidden
        className='absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(to_top,white/8,transparent)]'
      />
      {isChampion && (
        <motion.div
          aria-hidden
          className='absolute top-3 right-3 text-amber-200/70'
          animate={
            reduceMotion
              ? undefined
              : { opacity: [0.45, 1, 0.45], scale: [0.9, 1.1, 0.9] }
          }
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <HugeiconsIcon icon={SparklesIcon} className='size-5' />
        </motion.div>
      )}

      <div className='relative mb-2 h-7 sm:h-9'>
        {isChampion && (
          <motion.div
            animate={
              reduceMotion ? undefined : { y: [0, -4, 0], rotate: [-3, 3, -3] }
            }
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <HugeiconsIcon
              icon={CrownIcon}
              className='size-7 text-amber-300 sm:size-9'
            />
          </motion.div>
        )}
      </div>
      <RankingAvatar
        name={name}
        className={cn('relative', avatarStyles[props.position])}
        fallbackClassName={cn(
          'bg-white/10 text-white',
          isChampion && 'bg-amber-300/15 text-amber-100 text-xl'
        )}
      />
      <div className='relative mt-3 flex w-full min-w-0 flex-1 flex-col items-center'>
        <Badge
          className='border-white/15 bg-white/10 text-white'
          variant='outline'
        >
          <HugeiconsIcon icon={medalIcon} />
          NO.{props.position}
        </Badge>
        <p className='mt-2 w-full truncate text-xs font-semibold sm:text-base'>
          {name}
        </p>
        {props.entry ? (
          <>
            <AnimatedTokenNumber
              value={props.entry.total_tokens}
              className='mt-2 block max-w-full text-xs font-bold tabular-nums sm:text-lg'
            />
            <span className='text-[9px] text-white/50 sm:text-xs'>Token</span>
            {props.entry.reward_quota != null && (
              <p
                className={cn(
                  'mt-2 max-w-full truncate text-xs font-bold text-amber-200 sm:text-lg',
                  isChampion && 'sm:text-xl'
                )}
              >
                {formatQuota(props.entry.reward_quota)}
              </p>
            )}
          </>
        ) : (
          <p className='mt-3 text-[10px] leading-4 text-white/45 sm:text-xs'>
            {t('The next name here could be yours.')}
          </p>
        )}
      </div>
      <span className='relative mt-3 text-3xl font-black text-white/10 tabular-nums sm:text-5xl'>
        {props.position}
      </span>
    </motion.li>
  )
}
