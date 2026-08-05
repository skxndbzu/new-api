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
import { zodResolver } from '@hookform/resolvers/zod'
import { InformationCircleIcon, SaveIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useMemo } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { formatQuota } from '@/lib/format'

import { useTokenPeakConfig } from '../hooks/use-token-peak-config'
import {
  createTokenPeakConfigSchema,
  type TokenPeakConfigFormValues,
} from '../lib/config-schema'

const DEFAULT_VALUES: TokenPeakConfigFormValues = {
  enabled: false,
  reward_count: 3,
  rewards: [
    { position: 1, reward_quota: 0 },
    { position: 2, reward_quota: 0 },
    { position: 3, reward_quota: 0 },
  ],
}

export function TokenPeakSettings() {
  const { t } = useTranslation()
  const { configQuery, updateConfig } = useTokenPeakConfig()
  const schema = useMemo(() => createTokenPeakConfigSchema(t), [t])
  const form = useForm<TokenPeakConfigFormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
  })
  const rewards = useFieldArray({ control: form.control, name: 'rewards' })
  const enabled = form.watch('enabled')
  const watchedRewards = form.watch('rewards')

  useEffect(() => {
    const config = configQuery.data?.data
    if (!config) return
    form.reset({
      enabled: config.enabled,
      reward_count: config.reward_count,
      rewards: config.rewards,
    })
  }, [configQuery.data?.data, form])

  const updateRewardCount = (rawValue: string) => {
    const parsed = Number(rawValue)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      form.setValue('reward_count', parsed, { shouldValidate: true })
      return
    }

    const currentRewards = form.getValues('rewards')
    const nextRewards = Array.from({ length: parsed }, (_, index) => {
      const position = index + 1
      return (
        currentRewards.find((reward) => reward.position === position) ?? {
          position,
          reward_quota: 0,
        }
      )
    })
    form.setValue('reward_count', parsed, {
      shouldDirty: true,
      shouldValidate: true,
    })
    rewards.replace(nextRewards)
  }

  const onSubmit = async (values: TokenPeakConfigFormValues) => {
    const response = await updateConfig.mutateAsync(values)
    if (!response.success) {
      toast.error(response.message || t('Failed to save Token Peak settings'))
      return
    }
    form.reset(response.data)
    toast.success(t('Token Peak settings saved'))
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Token Peak settings')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          onClick={form.handleSubmit(onSubmit)}
          disabled={updateConfig.isPending || configQuery.isLoading}
        >
          {updateConfig.isPending ? (
            <Spinner data-icon='inline-start' />
          ) : (
            <HugeiconsIcon icon={SaveIcon} data-icon='inline-start' />
          )}
          {t('Save settings')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        {(() => {
          if (configQuery.isLoading) return <SettingsSkeleton />
          if (configQuery.isError || !configQuery.data?.data) {
            return (
              <ErrorState
                title={t('Unable to load Token Peak settings')}
                description={t('Check your connection and try again.')}
                onRetry={() => configQuery.refetch()}
              />
            )
          }
          return (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className='mx-auto grid w-full max-w-6xl gap-4 pb-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start'
              >
                <div className='flex min-w-0 flex-col gap-4'>
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('Activity status')}</CardTitle>
                      <CardDescription>
                        {t('Control whether users can enter the daily event.')}
                      </CardDescription>
                      <CardAction>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(checked) =>
                            form.setValue('enabled', checked, {
                              shouldDirty: true,
                            })
                          }
                          aria-label={t('Activity status')}
                        />
                      </CardAction>
                    </CardHeader>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{t('Number of reward positions')}</CardTitle>
                      <CardDescription>
                        {t('Set how many positions receive a daily reward.')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name='reward_count'
                        render={({ field }) => (
                          <FormItem className='max-w-xs'>
                            <FormLabel>{t('Reward positions')}</FormLabel>
                            <FormControl>
                              <Input
                                type='number'
                                min={1}
                                max={100}
                                value={field.value}
                                onBlur={field.onBlur}
                                onChange={(event) =>
                                  updateRewardCount(event.target.value)
                                }
                              />
                            </FormControl>
                            <FormDescription>
                              {t(
                                'Reward rules are generated for positions 1 through N.'
                              )}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{t('Reward rules')}</CardTitle>
                      <CardDescription>
                        {t('Amounts use the current new-api quota unit.')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='flex flex-col gap-3'>
                      {rewards.fields.map((reward, index) => (
                        <div key={reward.id}>
                          {index > 0 && <Separator className='mb-3' />}
                          <FormField
                            control={form.control}
                            name={`rewards.${index}.reward_quota`}
                            render={({ field }) => (
                              <FormItem className='grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_220px]'>
                                <div>
                                  <FormLabel>
                                    {t('Position {{position}}', {
                                      position: index + 1,
                                    })}
                                  </FormLabel>
                                  <FormDescription>
                                    {t('Daily settlement reward quota')}
                                  </FormDescription>
                                </div>
                                <div>
                                  <FormControl>
                                    <Input
                                      type='number'
                                      min={0}
                                      step={1}
                                      value={field.value}
                                      onBlur={field.onBlur}
                                      onChange={(event) =>
                                        field.onChange(
                                          event.target.valueAsNumber
                                        )
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Alert>
                    <HugeiconsIcon icon={InformationCircleIcon} />
                    <AlertTitle>{t('Settlement notes')}</AlertTitle>
                    <AlertDescription>
                      {t(
                        'Final settlement completes at 00:10 Beijing Time. Ranking records and rewards are determined by the backend.'
                      )}
                    </AlertDescription>
                  </Alert>
                </div>

                <Card className='lg:sticky lg:top-4'>
                  <CardHeader>
                    <CardTitle>{t('Reward preview')}</CardTitle>
                    <CardDescription>
                      {enabled
                        ? t('Visible to users')
                        : t('Activity is closed')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='flex flex-col gap-2'>
                    {watchedRewards.map((reward) => (
                      <div
                        key={reward.position}
                        className='bg-muted/40 flex min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2.5'
                      >
                        <span className='text-muted-foreground text-sm'>
                          {t('Position {{position}}', {
                            position: reward.position,
                          })}
                        </span>
                        <span className='truncate text-sm font-semibold tabular-nums'>
                          {Number.isFinite(reward.reward_quota)
                            ? formatQuota(reward.reward_quota)
                            : '-'}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </form>
            </Form>
          )
        })()}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function SettingsSkeleton() {
  return (
    <div className='mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_320px]'>
      <div className='flex flex-col gap-4'>
        <Skeleton className='h-28 rounded-xl' />
        <Skeleton className='h-44 rounded-xl' />
        <Skeleton className='h-96 rounded-xl' />
      </div>
      <Skeleton className='h-72 rounded-xl' />
    </div>
  )
}
