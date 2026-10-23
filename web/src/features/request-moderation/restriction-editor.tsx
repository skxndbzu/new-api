import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

import { useModerationMutation } from './api'
import { restrictionSchema } from './schema'
import type { Restriction } from './types'

type FormValues = z.infer<typeof restrictionSchema>
export function RestrictionEditor(props: {
  restriction: Partial<Restriction>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<FormValues | null>(null)
  const r = props.restriction
  const form = useForm<FormValues>({
    resolver: zodResolver(restrictionSchema),
    defaultValues: {
      subject: r.subject === 'token' ? 'token' : 'user',
      subject_id: r.subject_id ?? 0,
      channel_id: r.channel_id ?? 0,
      reason: r.reason ?? '',
      hours: r.expires_at
        ? Math.max(1, Math.ceil((r.expires_at * 1000 - Date.now()) / 3600000))
        : 0,
    },
  })
  const save = useModerationMutation<Partial<Restriction>>('/restrictions')
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      title={t('Restrict future requests')}
    >
      <form className='space-y-4' onSubmit={form.handleSubmit(setPending)}>
        <Label htmlFor='restriction-subject'>{t('Restriction subject')}</Label>
        <NativeSelect
          id='restriction-subject'
          {...form.register('subject')}
          disabled={Boolean(r.id)}
        >
          <NativeSelectOption value='user'>{t('User')}</NativeSelectOption>
          <NativeSelectOption value='token'>{t('Token')}</NativeSelectOption>
        </NativeSelect>
        {(
          [
            ['subject_id', t('User or token ID')],
            ['channel_id', t('Channel ID')],
            ['hours', t('Restriction hours (0 = permanent)')],
          ] as const
        ).map(([name, label]) => (
          <div key={name} className='space-y-2'>
            <Label htmlFor={`restriction-${name}`}>{label}</Label>
            <Input
              id={`restriction-${name}`}
              type='number'
              min={name === 'hours' ? 0 : 1}
              readOnly={Boolean(r.id) && name !== 'hours'}
              {...form.register(name, { valueAsNumber: true })}
            />
          </div>
        ))}
        <Label htmlFor='restriction-reason'>{t('Reason')}</Label>
        <Textarea
          id='restriction-reason'
          {...form.register('reason')}
          maxLength={500}
        />
        {Object.keys(form.formState.errors).length > 0 && (
          <p role='alert' className='text-destructive'>
            {t('Check the moderation limits and required fields.')}
          </p>
        )}
        <Button type='submit' variant='destructive'>
          {t('Save restriction')}
        </Button>
      </form>
      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
        title={t('Confirm restriction')}
        desc={t(
          'This restriction applies only to the selected channel and future requests.'
        )}
        destructive
        isLoading={save.isPending}
        handleConfirm={() => {
          if (pending) {
            save.mutate(
              {
                ...r,
                ...pending,
                expires_at:
                  pending.hours === 0
                    ? 0
                    : Math.floor(Date.now() / 1000) + pending.hours * 3600,
              },
              { onSuccess: props.onClose }
            )
          }
        }}
      />
    </Dialog>
  )
}
