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
import { BRAND_CONFIG } from '@/config/brand'
import { Mail, MessageCircle, QrCode, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CopyButton } from '@/components/copy-button'
import { PublicLayout } from '@/components/layout'

const CONTACT_ITEMS = [
  {
    key: 'qq',
    labelKey: 'QQ',
    valueKey: 'QQ number pending',
    descriptionKey: 'For one-on-one support and account inquiries',
    icon: MessageCircle,
  },
  {
    key: 'wechat',
    labelKey: 'WeChat',
    valueKey: 'WeChat ID pending',
    descriptionKey: 'Add the official WeChat account for service support',
    icon: QrCode,
  },
  {
    key: 'qq-group',
    labelKey: 'QQ Group',
    valueKey: 'QQ group number pending',
    descriptionKey: 'Join the QQ group for announcements and community help',
    icon: UsersRound,
  },
  {
    key: 'wechat-group',
    labelKey: 'WeChat Group',
    valueKey: 'WeChat group invitation pending',
    descriptionKey: 'Contact WeChat support to join the WeChat group',
    icon: UsersRound,
  },
  {
    key: 'email',
    labelKey: 'Email',
    valueKey: 'support@example.com',
    descriptionKey: 'Send billing, account, and cooperation requests by email',
    icon: Mail,
  },
] as const

export function About() {
  const { t } = useTranslation()

  return (
    <PublicLayout>
      <div className='mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 md:py-16'>
        <section className='mx-auto max-w-3xl space-y-4 text-center'>
          <p className='text-primary text-sm font-medium tracking-normal'>
            {BRAND_CONFIG.brandName}
          </p>
          <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>
            {t('footer.columns.about.links.contact')}
          </h1>
          <p className='text-muted-foreground text-base leading-7 md:text-lg'>
            {t(
              'Reach us through QQ, WeChat, groups, or email. Replace these placeholders with your official contact details before publishing.'
            )}
          </p>
        </section>

        <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {CONTACT_ITEMS.map((item) => {
            const Icon = item.icon
            const value = t(item.valueKey)
            return (
              <Card key={item.key} className='rounded-lg'>
                <CardHeader className='gap-3'>
                  <div className='bg-primary/10 text-primary flex size-11 items-center justify-center rounded-lg'>
                    <Icon className='size-5' />
                  </div>
                  <div className='space-y-1'>
                    <CardTitle>{t(item.labelKey)}</CardTitle>
                    <CardDescription>{t(item.descriptionKey)}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className='bg-muted/50 flex min-h-12 items-center justify-between gap-3 rounded-lg px-3 py-2'>
                    <span className='font-medium break-all'>{value}</span>
                    <CopyButton
                      value={value}
                      tooltip={t('Copy contact information')}
                      successTooltip={t('Copied!')}
                      aria-label={t('Copy contact information')}
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>

        <section className='border-border text-muted-foreground mx-auto max-w-3xl border-t pt-6 text-center text-sm leading-6'>
          <p className='mt-2'>{t(BRAND_CONFIG.openSourceNoticeKey)}</p>
        </section>
      </div>
    </PublicLayout>
  )
}
