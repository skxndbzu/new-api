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
  FireIcon,
  MedalFirstPlaceIcon,
  StarAward01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import type { TokenPeakRecords } from '../types'
import { AnimatedTokenNumber } from './animated-token-number'
import { SectionHeading } from './section-heading'

type RecordsSectionProps = {
  records?: TokenPeakRecords
}

export function RecordsSection(props: RecordsSectionProps) {
  const { t } = useTranslation()

  if (!props.records) return null

  const records = [
    {
      title: t('Highest single-day Token usage'),
      holder: props.records.highest_daily_tokens.ranking_name,
      value: props.records.highest_daily_tokens.champion_tokens,
      suffix: ' Token',
      icon: StarAward01Icon,
    },
    {
      title: t('Most championships'),
      holder: props.records.most_championships.ranking_name,
      value: props.records.most_championships.champion_count,
      suffix: ` ${t('wins')}`,
      icon: MedalFirstPlaceIcon,
    },
    {
      title: t('Longest championship streak'),
      holder: props.records.longest_streak.ranking_name,
      value: props.records.longest_streak.streak_days,
      suffix: ` ${t('days')}`,
      icon: FireIcon,
    },
  ]

  return (
    <section className='flex flex-col gap-4'>
      <SectionHeading
        title={t('All-time peak records')}
        description={t('The marks every contender is trying to break.')}
      />
      <div className='grid gap-3 md:grid-cols-3'>
        {records.map((record) => (
          <Card key={record.title} size='sm'>
            <CardHeader>
              <div className='bg-primary/10 text-primary mb-2 flex size-8 items-center justify-center rounded-lg'>
                <HugeiconsIcon icon={record.icon} className='size-4' />
              </div>
              <CardTitle>{record.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <AnimatedTokenNumber
                value={record.value}
                suffix={record.suffix}
                className='block text-xl font-semibold tabular-nums'
              />
              <p className='text-muted-foreground mt-1 truncate text-xs'>
                {record.holder}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
