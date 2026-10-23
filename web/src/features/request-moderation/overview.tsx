import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { moderationGet, moderationKey } from './api'
import { statusLabel } from './status'
import type { Overview } from './types'

export function ModerationOverview() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const query = useQuery({
    queryKey: [...moderationKey, 'overview'],
    queryFn: () => moderationGet<Overview>('/overview'),
    refetchInterval: 5000,
  })
  if (query.isPending) return <LoadingState />
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />
  const data = query.data
  if (!data.available) {
    return (
      <ErrorState
        title={t('Request moderation is unavailable')}
        description={t(
          'Configure REQUEST_MODERATION_DSN and REQUEST_MODERATION_ENCRYPTION_KEY, then restart the gateway.'
        )}
        onRetry={() => query.refetch()}
      />
    )
  }
  const counters: Record<string, number> = { ...data.local_counters }
  for (const item of data.counters) {
    counters[item.name] = (counters[item.name] ?? 0) + item.value
  }
  const metrics = [
    [t('Queue tasks on this instance'), data.queue_tasks],
    [t('Queue bytes on this instance'), data.queue_bytes],
    [t('Reserved model calls today (UTC)'), data.budget.calls],
    [t('Reported tokens today (UTC)'), data.budget.tokens],
  ] as const
  return (
    <div className='space-y-4'>
      <p className='rounded-lg border p-3 text-sm'>
        {data.healthy
          ? t('Moderation database connected')
          : t('Moderation database unavailable; requests are allowed')}
        {' · '}
        {data.config?.enabled ? t('Enabled') : t('Disabled')}
      </p>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        {metrics.map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
            </CardHeader>
            <CardContent className='text-2xl'>
              {formatNumber(value, locale)}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Estimated cost unknown. Reported upstream usage is separate from user billing.'
        )}
      </p>
      <p className='text-muted-foreground text-sm'>
        {t('Calls with unknown usage')}:{' '}
        {formatNumber(data.budget.unknown_calls, locale)}.{' '}
        {t(
          'Call reservations include attempts interrupted by a crash. Token totals include only reported usage.'
        )}
      </p>
      <p className='text-muted-foreground text-sm'>
        {t('Reserved token budget')}:{' '}
        {formatNumber(data.budget.reserved_tokens, locale)}.{' '}
        {t(
          'Unknown or interrupted calls keep a conservative token reservation until the next UTC day.'
        )}
      </p>
      <p className='text-sm'>
        {t('Oldest pending request')}:{' '}
        {data.oldest_pending
          ? new Date(data.oldest_pending * 1000).toLocaleString(locale)
          : '—'}
      </p>
      <div className='grid gap-4 lg:grid-cols-3'>
        {[
          { title: t('Request states'), items: data.statuses },
          { title: t('Machine verdicts'), items: data.verdicts },
          {
            title: t('Monitoring counters (7 days)'),
            items: Object.entries(counters).map(([name, count]) => ({
              name,
              count,
            })),
          },
        ].map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className='space-y-2'>
                {group.items.map((item) => (
                  <div key={item.name} className='flex justify-between gap-3'>
                    <dt className='break-all'>{statusLabel(item.name, t)}</dt>
                    <dd>{formatNumber(item.count, locale)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Accepted memory events can be lost on a hard crash. Persisted tasks recover after restart. Restrictions refresh within 5 seconds; stale nodes allow requests.'
        )}
      </p>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Token budgets use reported usage and may be exceeded by in-flight calls. Unknown prices are never shown as zero.'
        )}
      </p>
    </div>
  )
}
