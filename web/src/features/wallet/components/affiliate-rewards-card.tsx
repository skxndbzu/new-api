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
import { Clock3, Gift, Share2, Users, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'

import type { UserWalletData } from '../types'

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  affiliateLink: string
  onTransfer: () => void
  complianceConfirmed?: boolean
  loading?: boolean
}

export function AffiliateRewardsCard(props: AffiliateRewardsCardProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <Card data-card-hover='false' className='gap-0 py-0'>
        <CardHeader className='gap-3 border-b py-4 sm:px-5'>
          <Skeleton className='h-5 w-28' />
          <div className='flex items-center gap-3'>
            <Skeleton className='size-10 rounded-xl' />
            <div className='flex min-w-0 flex-1 flex-col gap-2'>
              <Skeleton className='h-5 w-52 max-w-full' />
              <Skeleton className='h-4 w-96 max-w-full' />
            </div>
          </div>
        </CardHeader>
        <CardContent className='p-4 sm:p-5'>
          <Skeleton className='h-56 rounded-lg sm:h-24' />
        </CardContent>
        <CardFooter className='flex-col items-stretch gap-3 sm:px-5'>
          <Skeleton className='h-4 w-32' />
          <div className='flex flex-col gap-2 sm:flex-row'>
            <Skeleton className='h-9 min-w-0 flex-1' />
            <Skeleton className='h-9 w-full sm:w-36' />
          </div>
        </CardFooter>
      </Card>
    )
  }

  const hasRewards = (props.user?.aff_quota ?? 0) > 0
  const complianceConfirmed = props.complianceConfirmed ?? true

  return (
    <Card
      data-card-hover='false'
      className='from-primary/[0.07] via-card to-chart-3/[0.07] gap-0 bg-gradient-to-br py-0 shadow-sm transition-shadow hover:shadow-md'
    >
      <CardHeader className='border-primary/10 bg-background/30 gap-3 border-b py-4 sm:px-5'>
        <Badge variant='secondary'>
          <Gift data-icon='inline-start' />
          {t('Referral Program')}
        </Badge>
        <div className='flex min-w-0 items-start gap-3'>
          <IconBadge tone='primary' size='lg'>
            <Share2 />
          </IconBadge>
          <div className='min-w-0'>
            <CardTitle className='text-base font-semibold sm:text-lg'>
              {t('Invite friends and earn referral rewards')}
            </CardTitle>
            <CardDescription className='mt-1 max-w-3xl text-xs leading-relaxed sm:text-sm'>
              {t(
                'Earn rewards when friends register and top up through your referral link.'
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className='p-4 sm:p-5'>
        <div
          data-referral-stats
          className='bg-background/70 ring-foreground/10 grid grid-cols-1 overflow-hidden rounded-lg ring-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr]'
        >
          <div className='flex min-h-20 min-w-0 items-center gap-3 px-4 py-3'>
            <IconBadge tone='success' size='md'>
              <WalletCards />
            </IconBadge>
            <div className='min-w-0'>
              <p className='text-muted-foreground text-xs font-medium'>
                {t('Total referral earnings')}
              </p>
              <p className='mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl'>
                {formatQuota(props.user?.aff_history_quota ?? 0)}
              </p>
            </div>
          </div>

          <Separator className='sm:hidden' />
          <Separator orientation='vertical' className='hidden sm:block' />

          <div className='flex min-h-20 min-w-0 items-center gap-3 px-4 py-3'>
            <IconBadge tone='warning' size='md'>
              <Clock3 />
            </IconBadge>
            <div className='min-w-0'>
              <p className='text-muted-foreground text-xs font-medium'>
                {t('Pending')}
              </p>
              <p className='mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl'>
                {formatQuota(props.user?.aff_quota ?? 0)}
              </p>
            </div>
          </div>

          <Separator className='sm:hidden' />
          <Separator orientation='vertical' className='hidden sm:block' />

          <div className='flex min-h-20 min-w-0 items-center gap-3 px-4 py-3'>
            <IconBadge tone='chart-3' size='md'>
              <Users />
            </IconBadge>
            <div className='min-w-0'>
              <p className='text-muted-foreground text-xs font-medium'>
                {t('Successful invites')}
              </p>
              <p className='mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl'>
                {t('{{count}} people', {
                  count: props.user?.aff_count ?? 0,
                })}
              </p>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className='bg-background/55 flex-col items-stretch gap-3 p-4 sm:p-5'>
        <div className='flex flex-col gap-1'>
          <label htmlFor='affiliate-link' className='text-sm font-semibold'>
            {t('My referral link')}
          </label>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Rewards are credited automatically when friends register and top up.'
            )}
          </p>
        </div>

        <div
          data-referral-link-actions
          className='flex flex-col items-stretch gap-2 sm:flex-row'
        >
          <Input
            id='affiliate-link'
            value={props.affiliateLink}
            readOnly
            className='bg-background min-w-0 flex-1 font-mono text-xs'
          />
          <CopyButton
            value={props.affiliateLink}
            variant='default'
            size='lg'
            className='w-full sm:w-auto'
            tooltip={t('Copy referral link')}
            aria-label={t('Copy referral link')}
            notify
          >
            {t('Copy referral link')}
          </CopyButton>
          {hasRewards ? (
            <Button
              onClick={props.onTransfer}
              disabled={!complianceConfirmed}
              variant='outline'
              className='w-full sm:w-auto'
              size='lg'
            >
              {t('Transfer to Balance')}
            </Button>
          ) : null}
        </div>

        {!complianceConfirmed ? (
          <p className='text-muted-foreground text-xs'>
            {t(
              'Referral reward transfer is disabled until the administrator confirms compliance terms.'
            )}
          </p>
        ) : null}
      </CardFooter>
    </Card>
  )
}
