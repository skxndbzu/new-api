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
  Clock01Icon,
  CrownIcon,
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
    <section className='relative isolate overflow-hidden rounded-lg bg-[linear-gradient(120deg,oklch(0.16_0.035_255),oklch(0.22_0.07_205)_48%,oklch(0.25_0.08_72))] px-5 py-7 text-white shadow-lg shadow-black/10 sm:px-8 sm:py-10'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [mask-image:linear-gradient(to_right,black,transparent_75%)] [background-size:38px_38px] opacity-[0.12]'
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
          <div className='mt-5 flex items-center gap-3'>
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
            <h1 className='text-2xl leading-tight font-semibold sm:text-4xl'>
              {t('Daily Token Peak')}
            </h1>
          </div>
          <p className='mt-3 max-w-xl text-sm leading-6 text-white/70 sm:text-base'>
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
          <div className='min-w-0 rounded-lg border border-white/15 bg-black/20 p-4 shadow-xl shadow-black/10 backdrop-blur-sm'>
            <div className='flex items-center gap-2 text-xs font-medium text-white/65'>
              <HugeiconsIcon icon={Clock01Icon} className='size-4' />
              {t("Until today's settlement")}
              <span className='ml-auto text-white/45'>{t('Beijing Time')}</span>
            </div>
            <div className='mt-3 grid grid-cols-3 gap-2' aria-live='off'>
              <CountdownUnit value={countdown.hours} label={t('Hours')} />
              <CountdownUnit value={countdown.minutes} label={t('Minutes')} />
              <CountdownUnit value={countdown.seconds} label={t('Seconds')} />
            </div>
            <p className='mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-white/55'>
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
    <div className='rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-center'>
      <div className='text-xl font-semibold tabular-nums sm:text-2xl'>
        {String(props.value).padStart(2, '0')}
      </div>
      <div className='mt-0.5 text-[10px] text-white/50'>{props.label}</div>
    </div>
  )
}
