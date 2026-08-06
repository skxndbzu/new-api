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
  Calendar03Icon,
  MedalFirstPlaceIcon,
  SparklesIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

export function TokenPeakLoading() {
  return (
    <div className='flex flex-col gap-5' aria-busy='true'>
      <Skeleton className='h-64 w-full rounded-xl sm:h-72' />
      <Skeleton className='h-72 w-full rounded-xl' />
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className='h-16 rounded-xl' />
        ))}
      </div>
      <Skeleton className='h-80 w-full rounded-xl' />
    </div>
  )
}

export function TokenPeakClosed() {
  const { t } = useTranslation()

  return (
    <div className='bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1'>
      <Empty className='min-h-[320px] border-0 px-5'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon icon={Calendar03Icon} />
          </EmptyMedia>
          <EmptyTitle className='text-base'>
            {t('The event is not open yet')}
          </EmptyTitle>
          <EmptyDescription>
            {t(
              'Token Peak is a daily usage challenge where the leading users can earn quota rewards.'
            )}
          </EmptyDescription>
        </EmptyHeader>
        <div className='text-muted-foreground grid w-full max-w-2xl gap-3 text-left text-sm sm:grid-cols-2'>
          <div className='flex gap-2'>
            <HugeiconsIcon
              icon={MedalFirstPlaceIcon}
              className='text-primary mt-0.5 size-4 shrink-0'
            />
            <span>{t('Compete on daily recorded Token usage.')}</span>
          </div>
          <div className='flex gap-2'>
            <HugeiconsIcon
              icon={SparklesIcon}
              className='text-primary mt-0.5 size-4 shrink-0'
            />
            <span>{t('Reach a reward position before settlement.')}</span>
          </div>
        </div>
      </Empty>
    </div>
  )
}
