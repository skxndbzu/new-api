import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { moderationGet, moderationKey, useModerationMutation } from './api'
import { PolicyEditor } from './policy-editor'
import { configSchema } from './schema'
import type { ChannelOption, ModerationConfig, Policy, Settings } from './types'

export function ModerationSettings() {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<Policy | null>(null)
  const settings = useQuery({
    queryKey: [...moderationKey, 'settings'],
    queryFn: () => moderationGet<Settings>('/settings'),
  })
  const channels = useQuery({
    queryKey: [...moderationKey, 'channels'],
    queryFn: () => moderationGet<ChannelOption[]>('/channels'),
  })
  if (settings.isPending || channels.isPending) return <LoadingState />
  if (settings.isError || channels.isError) {
    return (
      <ErrorState
        onRetry={() => {
          settings.refetch()
          channels.refetch()
        }}
      />
    )
  }
  return (
    <div className='space-y-6'>
      <ConfigForm config={settings.data.config} />
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle>{t('Moderation policies')}</CardTitle>
          <Button onClick={() => setEditing(settings.data.default_policy)}>
            {t('Add')}
          </Button>
        </CardHeader>
        <CardContent className='space-y-3'>
          {settings.data.policies.map((policy) => (
            <div
              key={policy.id}
              className='flex items-center justify-between gap-3 rounded-lg border p-3'
            >
              <div>
                <p className='font-medium'>{policy.name}</p>
                <p className='text-muted-foreground text-sm'>
                  {policy.enabled ? t('Enabled') : t('Disabled')}
                  {' · '}
                  {t('Version')} {policy.version}
                  {' · '}
                  {policy.auto_restrict
                    ? t('Automatic restrictions')
                    : t('Record only')}
                </p>
              </div>
              <Button variant='outline' onClick={() => setEditing(policy)}>
                {t('Edit')}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      {editing && (
        <PolicyEditor
          policy={editing}
          channels={channels.data}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function ConfigForm(props: { config: ModerationConfig }) {
  const { t } = useTranslation()
  const form = useForm<ModerationConfig>({
    resolver: zodResolver(configSchema),
    values: props.config,
  })
  const save = useModerationMutation<ModerationConfig>('/settings', 'put')
  const fields: [Exclude<keyof ModerationConfig, 'enabled'>, string][] = [
    ['queue_tasks', t('Queue tasks per instance')],
    ['queue_bytes', t('Queue bytes per instance')],
    ['max_body_bytes', t('Maximum request bytes')],
    ['scan_bytes', t('Maximum scan bytes')],
    ['review_bytes', t('Maximum review bytes')],
    ['workers', t('Workers per instance')],
    ['global_concurrency', t('Global model concurrency')],
    ['max_pending_tasks', t('Global pending task limit')],
    ['max_stored_bytes', t('Global retained body bytes')],
    ['daily_calls', t('Daily model call budget')],
    ['daily_tokens', t('Daily reported token budget')],
    ['pending_hours', t('Pending retention (hours)')],
    ['body_hours', t('Body retention (hours)')],
    ['evidence_hours', t('Violation evidence retention (hours)')],
    ['record_days', t('Record retention (days)')],
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Moderation settings')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className='space-y-4'
          onSubmit={form.handleSubmit((value) => save.mutate(value))}
        >
          <Controller
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <Label className='flex items-center gap-2'>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                {t('Enable request moderation')}
              </Label>
            )}
          />
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
            {fields.map(([key, label]) => (
              <div key={key} className='space-y-2'>
                <Label htmlFor={`moderation-${key}`}>{label}</Label>
                <Input
                  id={`moderation-${key}`}
                  type='number'
                  min={1}
                  {...form.register(key, { valueAsNumber: true })}
                  aria-invalid={Boolean(form.formState.errors[key])}
                />
              </div>
            ))}
          </div>
          {Object.keys(form.formState.errors).length > 0 && (
            <p role='alert' className='text-destructive'>
              {t('Check the moderation limits and required fields.')}
            </p>
          )}
          <p className='text-muted-foreground text-sm'>
            {t(
              'Disabling monitoring pauses model calls and preserves existing restrictions.'
            )}
          </p>
          <Button type='submit' disabled={save.isPending}>
            {t('Save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
