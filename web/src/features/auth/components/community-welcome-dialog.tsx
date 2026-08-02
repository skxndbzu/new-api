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
import { MessageCircle, Sparkles, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BRAND_CONFIG } from '@/config/brand'
import {
  clearPendingLoginWelcome,
} from '@/features/auth/lib/storage'

const SECONDARY_CONTACT_ITEMS = [
  {
    key: 'qq',
    labelKey: 'Customer Service QQ',
    valueKey: 'QQ number pending',
    icon: MessageCircle,
  },
  {
    key: 'wechat',
    labelKey: 'WeChat',
    valueKey: 'WeChat ID pending',
    icon: MessageCircle,
  },
] as const

export function CommunityWelcomeDialog() {
  const { t } = useTranslation()
  // Temporarily hide the welcome dialog that contains contact information.
  const [open, setOpen] = useState(false)

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      clearPendingLoginWelcome()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        initialFocus={false}
        className='max-h-[min(92svh,54rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl'
      >
        <DialogHeader className='relative overflow-hidden border-b px-5 py-4 sm:px-8 sm:py-6'>
          <div className='bg-primary/10 absolute -top-16 -right-12 size-44 rounded-full blur-3xl' />
          <div className='bg-primary/5 absolute -bottom-20 -left-16 size-48 rounded-full blur-3xl' />
          <div className='relative flex items-start gap-4'>
            <div className='bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-sm sm:size-12'>
              <Sparkles className='size-5' aria-hidden='true' />
            </div>
            <div className='min-w-0 space-y-1.5'>
              <p className='text-primary text-xs font-semibold tracking-[0.16em] uppercase'>
                {t('Signed in · Welcome back')}
              </p>
              <DialogTitle className='text-xl leading-tight font-semibold tracking-tight sm:text-2xl'>
                {t('Together with Qingniao API, turn ideas into reality')}
              </DialogTitle>
              <DialogDescription className='text-sm leading-6 sm:text-base'>
                {t(
                  'Stable access, issue feedback, and event updates — all in the Qingniao user group'
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className='min-h-0'>
          <div className='space-y-6 px-5 py-5 sm:px-8 sm:py-6'>
            <section aria-labelledby='community-contacts-title'>
              <div className='from-primary/12 via-primary/7 border-primary/25 shadow-primary/8 relative overflow-hidden rounded-2xl border bg-gradient-to-br to-white p-4 shadow-sm sm:p-5 dark:to-slate-950'>
                <div className='bg-primary/10 absolute -top-16 -right-12 size-40 rounded-full blur-2xl' />
                <div className='relative flex items-start gap-3 sm:gap-4'>
                  <div className='bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm'>
                    <UsersRound className='size-5' aria-hidden='true' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='mb-2 flex flex-wrap items-center gap-2'>
                      <h3
                        id='community-contacts-title'
                        className='text-base font-semibold sm:text-lg'
                      >
                        {t('Join the official Qingniao API user group')}
                      </h3>
                      <span className='bg-primary/12 text-primary rounded-full px-2.5 py-1 text-[0.7rem] font-semibold'>
                        {t('Recommended to join')}
                      </span>
                    </div>
                    <p className='text-muted-foreground text-sm leading-6'>
                      {t(
                        'To receive service notices, model updates, and usage instructions promptly, we recommend joining the official group. For quota, API call, model, or account issues, you can also report them directly in the group for faster communication and handling.'
                      )}
                    </p>
                    <p className='text-muted-foreground mt-2 text-sm leading-6'>
                      {t(
                        'The group also shares AI tools, usage tips, and platform events, making it a good fit for long-term Qingniao API users.'
                      )}
                    </p>
                    <div className='mt-4 flex flex-col gap-3 rounded-xl border border-white/70 bg-white/75 p-3 sm:flex-row sm:items-center dark:border-white/10 dark:bg-slate-950/60'>
                      <div className='min-w-0 flex-1'>
                        <p className='text-muted-foreground text-xs'>
                          {t('QQ Group Number')}
                        </p>
                        <p className='text-primary mt-0.5 text-lg font-semibold tracking-wide'>
                          {t('QQ group number pending')}
                        </p>
                      </div>
                      <CopyButton
                        value={t('QQ group number pending')}
                        variant='outline'
                        size='sm'
                        className='border-primary/30 text-primary hover:bg-primary/8 w-full sm:w-auto'
                        notify
                        successMessage={t(
                          'Copied. Open QQ and search the group number to join.'
                        )}
                        aria-label={t('Copy QQ group number')}
                      >
                        {t('Copy group number')}
                      </CopyButton>
                    </div>
                  </div>
                </div>
              </div>

              <div className='mt-3 grid gap-3 sm:grid-cols-2'>
                {SECONDARY_CONTACT_ITEMS.map((item) => {
                  const Icon = item.icon
                  const value = t(item.valueKey)

                  return (
                    <div
                      key={item.key}
                      className='bg-muted/35 flex items-center gap-3 rounded-xl border px-3.5 py-3'
                    >
                      <div className='bg-background text-primary flex size-9 shrink-0 items-center justify-center rounded-lg border shadow-xs'>
                        <Icon className='size-4' aria-hidden='true' />
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='text-muted-foreground text-xs'>
                          {t(item.labelKey)}
                        </p>
                        <p
                          className='truncate text-sm font-medium'
                          title={value}
                        >
                          {value}
                        </p>
                      </div>
                      <CopyButton
                        value={value}
                        variant='outline'
                        size='sm'
                        className='h-8 px-2.5'
                        iconClassName='size-3.5'
                        notify
                        successMessage={t('Contact information copied')}
                        aria-label={t('Copy contact information')}
                      >
                        {t('Copy')}
                      </CopyButton>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className='border-t pt-5'>
              <div className='text-muted-foreground space-y-3 text-sm leading-7 sm:text-[0.95rem]'>
                <p className='text-foreground font-medium'>
                  {t(
                    'We have always believed that AI should not be a tool reserved for a few.'
                  )}
                </p>
                <p>
                  {t(
                    'Qingniao API aims to lower the barrier to using AI, so that everyone who writes code, builds products, and creates services with care has the opportunity to truly bring their ideas to life.'
                  )}
                </p>
                <p>
                  {t(
                    'Beyond model access, we also hope to provide long-term support throughout your AI practice.'
                  )}
                </p>
                <p className='text-foreground font-semibold'>
                  {t(
                    'May everyone with an idea have the opportunity to turn it into reality.'
                  )}
                </p>
              </div>
            </section>
          </div>
        </ScrollArea>

        <div className='bg-background/95 space-y-3 border-t px-5 py-4 backdrop-blur sm:px-8'>
          <div className='flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-end'>
            <DialogClose render={<Button className='w-full sm:w-auto' />}>
              {t('Enter console')}
            </DialogClose>
          </div>
          <p className='text-muted-foreground text-center text-xs'>
            {BRAND_CONFIG.brandName} · {t('Built for every serious idea')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
