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
  ActivitySparkIcon,
  Award02Icon,
  ChampionIcon,
  Clock01Icon,
  CrownIcon,
  LaurelWreathFirst01Icon,
  SparklesIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { getCountdownParts, parseSettlementAt } from '../lib/time'

type TokenPeakHeroProps = {
  nextSettlementAt?: number | string | null
  enabled: boolean
}

const peakBarClasses = [
  'h-10',
  'h-16',
  'h-24',
  'h-14',
  'h-32',
  'h-20',
  'h-28',
  'h-12',
]

export function TokenPeakHero(props: TokenPeakHeroProps) {
  const { t } = useTranslation()
  const [now, setNow] = useState(Date.now())
  const reduceMotion = useReducedMotion()
  const target = parseSettlementAt(props.nextSettlementAt, now)
  const countdown = getCountdownParts(target, now)

  useEffect(() => {
    if (!props.enabled) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [props.enabled])

  return (
    <section className='relative isolate overflow-hidden rounded-lg border border-amber-300/15 bg-[linear-gradient(118deg,oklch(0.12_0.035_255),oklch(0.2_0.065_195)_52%,oklch(0.25_0.075_75))] px-5 py-7 text-white shadow-[0_24px_70px_-35px_oklch(0.5_0.12_75)] sm:px-8 sm:py-10'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [mask-image:linear-gradient(to_right,black,transparent_82%)] [background-size:42px_42px] opacity-[0.08]'
      />
      <div
        aria-hidden
        className='pointer-events-none absolute right-4 bottom-0 hidden h-40 w-[38%] items-end justify-end gap-2 opacity-20 lg:flex'
      >
        {peakBarClasses.map((className, index) => (
          <motion.div
            key={className}
            className={cn(
              'w-5 origin-bottom rounded-t-sm bg-white/60',
              className
            )}
            initial={reduceMotion ? false : { scaleY: 0.25, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{
              duration: 0.65,
              delay: index * 0.06,
              ease: 'easeOut',
            }}
          />
        ))}
      </div>
      <motion.div
        aria-hidden
        className='pointer-events-none absolute top-8 right-[42%] hidden lg:block'
        animate={
          reduceMotion ? undefined : { y: [0, -8, 0], rotate: [0, 8, 0] }
        }
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <HugeiconsIcon icon={SparklesIcon} className='text-warning/70 size-6' />
      </motion.div>
      <HugeiconsIcon
        aria-hidden
        icon={LaurelWreathFirst01Icon}
        className='pointer-events-none absolute -top-8 -right-8 size-56 text-amber-200/5 sm:size-72'
        strokeWidth={0.8}
      />

      <div className='relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:items-end'>
        <div className='max-w-2xl'>
          <Badge
            className='border-white/15 bg-white/10 text-white'
            variant='outline'
          >
            {props.enabled && (
              <span className='relative flex size-2' aria-hidden>
                <span className='bg-success absolute inline-flex size-full animate-ping rounded-full opacity-70 motion-reduce:animate-none' />
                <span className='bg-success relative inline-flex size-2 rounded-full' />
              </span>
            )}
            {props.enabled ? t("Today's challenge is live") : t('Token Peak')}
          </Badge>
          <div className='mt-6 flex items-center gap-3'>
            <motion.div
              className='bg-warning/15 text-warning ring-warning/25 flex size-11 shrink-0 items-center justify-center rounded-lg ring-1'
              animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <HugeiconsIcon
                icon={CrownIcon}
                className='size-6'
                strokeWidth={1.8}
              />
            </motion.div>
            <h1 className='text-3xl leading-tight font-bold sm:text-5xl'>
              {t('Daily Token Peak')}
            </h1>
          </div>
          <p className='mt-4 max-w-xl text-sm leading-6 text-white/70 sm:text-lg'>
            {t('Use more, rank higher, and win daily quota rewards.')}
          </p>
          <div className='mt-5 flex flex-wrap gap-2 text-xs text-white/65'>
            <span className='flex items-center gap-1.5 rounded-full border border-white/10 bg-black/10 px-3 py-1.5'>
              <HugeiconsIcon icon={ActivitySparkIcon} className='size-4' />
              {t('Updated about every 5 minutes')}
            </span>
            <span className='flex items-center gap-1.5 rounded-full border border-white/10 bg-black/10 px-3 py-1.5'>
              <HugeiconsIcon icon={Award02Icon} className='size-4' />
              {t('Daily rewards')}
            </span>
          </div>
        </div>

        {props.enabled && (
          <div className='relative min-w-0 overflow-hidden rounded-lg border border-amber-100/20 bg-black/25 p-4 shadow-2xl shadow-black/20 backdrop-blur-md sm:p-5'>
            <HugeiconsIcon
              aria-hidden
              icon={ChampionIcon}
              className='absolute -right-4 -bottom-5 size-28 text-white/5'
            />
            <div className='relative flex items-center gap-2 text-xs font-medium text-white/65'>
              <HugeiconsIcon icon={Clock01Icon} className='size-4' />
              {t("Until today's settlement")}
              <span className='ml-auto text-white/45'>{t('Beijing Time')}</span>
            </div>
            <div
              className='relative mt-4 grid grid-cols-3 gap-2'
              aria-live='off'
            >
              <CountdownUnit value={countdown.hours} label={t('Hours')} />
              <CountdownUnit value={countdown.minutes} label={t('Minutes')} />
              <CountdownUnit value={countdown.seconds} label={t('Seconds')} />
            </div>
            <p className='relative mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-white/55'>
              {t(
                'The leaderboard settles daily at 00:00; rewards arrive about 10-15 minutes later.'
              )}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function CountdownUnit(props: { value: number; label: string }) {
  return (
    <div className='rounded-md border border-white/10 bg-white/6 px-2 py-3 text-center shadow-inner sm:px-3'>
      <div className='text-2xl font-bold tabular-nums sm:text-4xl'>
        {String(props.value).padStart(2, '0')}
      </div>
      <div className='mt-1 text-[10px] font-medium text-white/50'>
        {props.label}
      </div>
    </div>
  )
}
