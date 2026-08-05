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
  Clock01Icon,
  CrownIcon,
  SparklesIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'

import { getCountdownParts, parseSettlementAt } from '../lib/time'

type TokenPeakHeroProps = {
  nextSettlementAt?: number | string | null
  enabled: boolean
}

export function TokenPeakHero(props: TokenPeakHeroProps) {
  const { t } = useTranslation()
  const target = parseSettlementAt(props.nextSettlementAt)
  const [now, setNow] = useState(Date.now())
  const countdown = getCountdownParts(target, now)

  useEffect(() => {
    if (!props.enabled) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [props.enabled])

  return (
    <section className='relative isolate overflow-hidden rounded-xl bg-[linear-gradient(125deg,oklch(0.18_0.025_255),oklch(0.22_0.045_205)_55%,oklch(0.22_0.045_75))] px-5 py-7 text-white shadow-lg shadow-black/10 sm:px-8 sm:py-10'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [mask-image:linear-gradient(to_right,black,transparent_75%)] [background-size:38px_38px] opacity-[0.12]'
      />
      <div className='relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end'>
        <div className='max-w-2xl'>
          <Badge
            className='border-white/15 bg-white/10 text-white'
            variant='outline'
          >
            <HugeiconsIcon icon={SparklesIcon} data-icon='inline-start' />
            {props.enabled ? t("Today's challenge is live") : t('Token Peak')}
          </Badge>
          <div className='mt-5 flex items-center gap-3'>
            <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15'>
              <HugeiconsIcon
                icon={CrownIcon}
                className='size-5'
                strokeWidth={1.8}
              />
            </div>
            <h1 className='text-2xl leading-tight font-semibold sm:text-4xl'>
              {t('Daily Token Peak')}
            </h1>
          </div>
          <p className='mt-3 max-w-xl text-sm leading-6 text-white/70 sm:text-base'>
            {t('Use more, rank higher, and win daily quota rewards.')}
          </p>
        </div>

        {props.enabled && (
          <div className='min-w-0 lg:min-w-[310px]'>
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
            <p className='mt-2 text-right text-[11px] text-white/45'>
              {t('Final settlement completes daily at 00:10.')}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function CountdownUnit(props: { value: number; label: string }) {
  return (
    <div className='rounded-lg border border-white/10 bg-black/15 px-3 py-2.5 text-center backdrop-blur-sm'>
      <div className='text-xl font-semibold tabular-nums sm:text-2xl'>
        {String(props.value).padStart(2, '0')}
      </div>
      <div className='mt-0.5 text-[10px] text-white/50'>{props.label}</div>
    </div>
  )
}
