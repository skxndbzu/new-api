import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { moderationGet, moderationKey, useModerationPermission } from './api'
import { ModerationDetail } from './record-detail'
import { statusLabel } from './status'
import { ModerationTable } from './table'
import type { ModerationTask, Page } from './types'

export function ModerationRecords() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })
  const [filters, setFilters] = useState<Record<string, string | boolean>>({
    review_only: true,
  })
  const [active, setActive] =
    useState<Record<string, string | boolean>>(filters)
  const [selected, setSelected] = useState<number | null>(null)
  const canView = useModerationPermission('body')
  const params = {
    ...active,
    page: pagination.pageIndex + 1,
    size: pagination.pageSize,
  }
  const query = useQuery({
    queryKey: [...moderationKey, 'records', params],
    queryFn: () => moderationGet<Page<ModerationTask>>('/records', params),
  })
  const columns: ColumnDef<ModerationTask, unknown>[] = [
    { accessorKey: 'id', header: t('ID') },
    {
      accessorKey: 'created_at',
      header: t('Time'),
      cell: ({ row }) =>
        new Date(row.original.created_at * 1000).toLocaleString(locale),
    },
    { accessorKey: 'user_id', header: t('User ID') },
    { accessorKey: 'token_id', header: t('Token ID') },
    { accessorKey: 'channel_id', header: t('Channel ID') },
    { accessorKey: 'model', header: t('Model') },
    {
      accessorKey: 'status',
      header: t('Status'),
      cell: ({ row }) => statusLabel(row.original.status, t),
    },
    {
      accessorKey: 'verdict',
      header: t('Machine verdict'),
      cell: ({ row }) => statusLabel(row.original.verdict, t),
    },
    {
      accessorKey: 'human_verdict',
      header: t('Human verdict'),
      cell: ({ row }) => statusLabel(row.original.human_verdict, t),
    },
    {
      accessorKey: 'complete',
      header: t('Coverage'),
      cell: ({ row }) => (row.original.complete ? t('Complete') : t('Partial')),
    },
    {
      id: 'actions',
      header: t('Actions'),
      cell: ({ row }) => (
        <Button
          variant='ghost'
          disabled={!canView}
          onClick={() => setSelected(row.original.id)}
        >
          {t('Details')}
        </Button>
      ),
    },
  ]
  return (
    <div className='space-y-4'>
      <form
        className='grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4'
        onSubmit={(event) => {
          event.preventDefault()
          setActive(filters)
          setPagination((value) => ({ ...value, pageIndex: 0 }))
        }}
      >
        {(
          [
            ['user_id', t('User ID')],
            ['token_id', t('Token ID')],
            ['channel_id', t('Channel ID')],
            ['policy_id', t('Policy ID')],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <Label htmlFor={`filter-${key}`}>{label}</Label>
            <Input
              id={`filter-${key}`}
              type='number'
              min={1}
              value={String(filters[key] ?? '')}
              onChange={(e) =>
                setFilters({ ...filters, [key]: e.target.value })
              }
            />
          </div>
        ))}
        <div>
          <Label htmlFor='filter-status'>{t('Status')}</Label>
          <NativeSelect
            id='filter-status'
            className='w-full'
            value={String(filters.status ?? '')}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <NativeSelectOption value=''>{t('All')}</NativeSelectOption>
            {[
              'pending',
              'running',
              'retry',
              'paused',
              'budget_paused',
              'completed',
              'failed',
              'expired',
            ].map((value) => (
              <NativeSelectOption key={value} value={value}>
                {statusLabel(value, t)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor='filter-category'>{t('Category')}</Label>
          <NativeSelect
            id='filter-category'
            className='w-full'
            value={String(filters.category ?? '')}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value })
            }
          >
            <NativeSelectOption value=''>{t('All')}</NativeSelectOption>
            {[
              'jailbreak',
              'malicious_cyber',
              'unauthorized_access',
              'other',
            ].map((value) => (
              <NativeSelectOption key={value} value={value}>
                {statusLabel(value, t)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {(
          [
            ['start', t('Start time')],
            ['end', t('End time')],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <Label htmlFor={`filter-${key}`}>{label}</Label>
            <Input
              id={`filter-${key}`}
              type='datetime-local'
              onChange={(e) =>
                setFilters({
                  ...filters,
                  [key]: e.target.value
                    ? String(
                        Math.floor(new Date(e.target.value).getTime() / 1000)
                      )
                    : '',
                })
              }
            />
          </div>
        ))}
        <Label className='flex items-center gap-2'>
          <Checkbox
            checked={filters.review_only === true}
            onCheckedChange={(checked) =>
              setFilters({ ...filters, review_only: checked === true })
            }
          />
          {t('Needs review only')}
        </Label>
        <Button type='submit'>{t('Filter')}</Button>
      </form>
      {query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <ModerationTable
          items={query.data?.items ?? []}
          columns={columns}
          total={query.data?.total ?? 0}
          pagination={pagination}
          onPaginationChange={setPagination}
          loading={query.isPending}
        />
      )}
      <p className='text-muted-foreground text-sm'>
        {t('Total:')} {formatNumber(query.data?.total ?? 0, locale)}
      </p>
      {selected !== null && (
        <ModerationDetail id={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
