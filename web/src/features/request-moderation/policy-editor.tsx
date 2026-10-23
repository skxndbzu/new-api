import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

import { useModerationMutation } from './api'
import { policySchema, type PolicyForm } from './schema'
import { ModerationTest } from './test-panel'
import type { ChannelOption, Policy } from './types'

export function PolicyEditor(props: {
  policy: Policy
  channels: ChannelOption[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [showTest, setShowTest] = useState(false)
  const form = useForm<PolicyForm>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      ...props.policy,
      primary: { ...props.policy.primary, protocol: 'chat' },
      channels: props.policy.channels ?? [],
      models: props.policy.models ?? [],
      keywords: props.policy.keywords ?? [],
      fallback: props.policy.fallback
        ? { ...props.policy.fallback, protocol: 'chat' }
        : null,
      subject: props.policy.subject === 'token' ? 'token' : 'user',
      min_severity: props.policy.min_severity as PolicyForm['min_severity'],
    },
  })
  const save = useModerationMutation<Policy>('/policies', 'put')
  const primary = form.watch('primary')
  const fallback = form.watch('fallback')
  const automatic = form.watch('auto_restrict')
  const selectedChannels = form.watch('channels')
  const targets = [
    { key: 'primary', value: primary, label: t('Primary review channel') },
    { key: 'fallback', value: fallback, label: t('Fallback review channel') },
  ] as const
  const fields = [
    ['sample_percent', t('Unmatched sampling (%)'), 0, 100],
    ['timeout_seconds', t('Review timeout (seconds)'), 1, 120],
    ['retries', t('Maximum retries'), 0, 5],
  ] as const
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      title={t('Moderation policy')}
      contentClassName='sm:max-w-4xl'
    >
      <form
        className='space-y-5'
        onSubmit={form.handleSubmit((value) =>
          save.mutate(value, { onSuccess: props.onClose })
        )}
      >
        <Label htmlFor='policy-name'>{t('Name')}</Label>
        <Input id='policy-name' {...form.register('name')} maxLength={128} />
        <Controller
          control={form.control}
          name='enabled'
          render={({ field }) => (
            <Label className='flex items-center gap-2'>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
              />
              {t('Enabled')}
            </Label>
          )}
        />
        <fieldset className='space-y-3 rounded-lg border p-3'>
          <legend>{t('Monitored business channels')}</legend>
          <div className='grid max-h-48 gap-2 overflow-auto sm:grid-cols-2'>
            {props.channels.map((channel) => (
              <Label key={channel.id} className='flex items-center gap-2'>
                <Checkbox
                  checked={selectedChannels.includes(channel.id)}
                  onCheckedChange={(checked) =>
                    form.setValue(
                      'channels',
                      checked
                        ? [...selectedChannels, channel.id]
                        : selectedChannels.filter((id) => id !== channel.id),
                      { shouldValidate: true }
                    )
                  }
                />
                {channel.name} (#{channel.id})
              </Label>
            ))}
          </div>
        </fieldset>
        <Label htmlFor='policy-models'>
          {t('Business models (one per line; empty means all)')}
        </Label>
        <Controller
          control={form.control}
          name='models'
          render={({ field }) => (
            <Textarea
              id='policy-models'
              value={field.value.join('\n')}
              onChange={(e) => field.onChange(e.target.value.split('\n'))}
            />
          )}
        />
        <Label htmlFor='policy-keywords'>{t('Keywords (one per line)')}</Label>
        <Controller
          control={form.control}
          name='keywords'
          render={({ field }) => (
            <Textarea
              id='policy-keywords'
              value={field.value.join('\n')}
              onChange={(e) => field.onChange(e.target.value.split('\n'))}
              className='min-h-28'
            />
          )}
        />
        <p className='text-muted-foreground text-sm'>
          {t(
            'Keyword matches always enter review. Empty keywords use sampling only. A keyword match is not a violation.'
          )}
        </p>
        <div className='grid gap-4 sm:grid-cols-3'>
          {fields.map(([name, label, min, max]) => (
            <div key={name} className='space-y-2'>
              <Label htmlFor={name}>{label}</Label>
              <Input
                id={name}
                type='number'
                min={min}
                max={max}
                step={name === 'sample_percent' ? '0.01' : '1'}
                {...form.register(name, { valueAsNumber: true })}
              />
            </div>
          ))}
        </div>
        <Label htmlFor='policy-rules'>{t('Review criteria')}</Label>
        <Textarea
          id='policy-rules'
          className='min-h-32'
          {...form.register('rules')}
          maxLength={16000}
        />
        <Label className='flex items-center gap-2'>
          <Checkbox
            checked={Boolean(fallback)}
            onCheckedChange={(enabled) =>
              form.setValue(
                'fallback',
                enabled ? { channel_id: 0, model: '', protocol: 'chat' } : null
              )
            }
          />
          {t('Enable fallback review channel')}
        </Label>
        {targets.map(
          (target) =>
            target.value && (
              <fieldset
                key={target.key}
                className='grid gap-3 rounded-lg border p-3 sm:grid-cols-2'
              >
                <legend>{target.label}</legend>
                <div className='space-y-2'>
                  <Label htmlFor={`${target.key}-channel`}>
                    {t('Channel')}
                  </Label>
                  <NativeSelect
                    id={`${target.key}-channel`}
                    className='w-full'
                    value={target.value.channel_id}
                    onChange={(e) =>
                      form.setValue(target.key, {
                        channel_id: Number(e.target.value),
                        model: '',
                        protocol: 'chat',
                      })
                    }
                  >
                    <NativeSelectOption value={0}>
                      {t('Select channel')}
                    </NativeSelectOption>
                    {props.channels
                      .filter(
                        (channel) =>
                          channel.review_supported && channel.status === 1
                      )
                      .map((channel) => (
                        <NativeSelectOption key={channel.id} value={channel.id}>
                          {channel.name} (#{channel.id})
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor={`${target.key}-model`}>{t('Model')}</Label>
                  <NativeSelect
                    id={`${target.key}-model`}
                    className='w-full'
                    value={target.value.model}
                    onChange={(e) =>
                      form.setValue(`${target.key}.model`, e.target.value)
                    }
                  >
                    <NativeSelectOption value=''>
                      {t('Select model')}
                    </NativeSelectOption>
                    {(
                      props.channels.find(
                        (channel) => channel.id === target.value?.channel_id
                      )?.models ?? ''
                    )
                      .split(',')
                      .filter(Boolean)
                      .map((model) => (
                        <NativeSelectOption key={model} value={model}>
                          {model}
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                </div>
                <p className='text-muted-foreground text-sm sm:col-span-2'>
                  {t(
                    'Review protocol: OpenAI-compatible Chat Completions (non-streaming)'
                  )}
                </p>
              </fieldset>
            )
        )}
        <Controller
          control={form.control}
          name='auto_restrict'
          render={({ field }) => (
            <Label className='flex items-center gap-2'>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
              />
              {t('Automatic restrictions')}
            </Label>
          )}
        />
        {automatic && (
          <div className='grid gap-4 rounded-lg border p-3 sm:grid-cols-2'>
            <div>
              <Label htmlFor='policy-subject'>{t('Restriction subject')}</Label>
              <NativeSelect id='policy-subject' {...form.register('subject')}>
                <NativeSelectOption value='user'>
                  {t('User')}
                </NativeSelectOption>
                <NativeSelectOption value='token'>
                  {t('Token')}
                </NativeSelectOption>
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor='policy-severity'>{t('Minimum severity')}</Label>
              <NativeSelect
                id='policy-severity'
                {...form.register('min_severity')}
              >
                <NativeSelectOption value='low'>{t('Low')}</NativeSelectOption>
                <NativeSelectOption value='medium'>
                  {t('Medium')}
                </NativeSelectOption>
                <NativeSelectOption value='high'>
                  {t('High')}
                </NativeSelectOption>
              </NativeSelect>
            </div>
            {(
              [
                ['window_hours', t('Violation window (hours)')],
                ['violation_count', t('Distinct violating requests')],
                ['restriction_hours', t('Restriction duration (hours)')],
              ] as const
            ).map(([name, label]) => (
              <div key={name}>
                <Label htmlFor={name}>{label}</Label>
                <Input
                  id={name}
                  type='number'
                  min={1}
                  {...form.register(name, { valueAsNumber: true })}
                />
              </div>
            ))}
            <p className='text-muted-foreground text-sm sm:col-span-2'>
              {t(
                'Only complete, validated violations can trigger automatic restrictions.'
              )}
            </p>
          </div>
        )}
        {Object.keys(form.formState.errors).length > 0 && (
          <p role='alert' className='text-destructive'>
            {t('Check the moderation limits and required fields.')}
          </p>
        )}
        <div className='flex gap-2'>
          <Button type='submit' disabled={save.isPending}>
            {t('Save')}
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={() => setShowTest(!showTest)}
          >
            {t('Test policy')}
          </Button>
          <Button type='button' variant='ghost' onClick={props.onClose}>
            {t('Cancel')}
          </Button>
        </div>
      </form>
      {showTest && <ModerationTest getPolicy={form.getValues} />}
    </Dialog>
  )
}
