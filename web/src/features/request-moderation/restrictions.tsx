import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { toIntlLocale } from '@/i18n/languages'

import {
  moderationGet,
  moderationKey,
  useModerationMutation,
  useModerationPermission,
} from './api'
import { ModerationDetail } from './record-detail'
import { RestrictionEditor } from './restriction-editor'
import { ModerationTable } from './table'
import type { Page, Restriction } from './types'

export function ModerationRestrictions() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [state, setState] = useState('active')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })
  const [editing, setEditing] = useState<Partial<Restriction> | null>(null)
  const [releasing, setReleasing] = useState<Restriction | null>(null)
  const [record, setRecord] = useState<number | null>(null)
  const canRestrict = useModerationPermission('restrict')
  const canView = useModerationPermission('body')
  const params = {
    state,
    page: pagination.pageIndex + 1,
    size: pagination.pageSize,
  }
  const query = useQuery({
    queryKey: [...moderationKey, 'restrictions', params],
    queryFn: () => moderationGet<Page<Restriction>>('/restrictions', params),
  })
  const release = useModerationMutation<Restriction & { release: boolean }>(
    '/restrictions'
  )
  const columns: ColumnDef<Restriction, unknown>[] = [
    { accessorKey: 'id', header: t('ID') },
    {
      accessorKey: 'subject',
      header: t('Restriction subject'),
      cell: ({ row }) =>
        row.original.subject === 'user' ? t('User') : t('Token'),
    },
    { accessorKey: 'subject_id', header: t('User or token ID') },
    { accessorKey: 'channel_id', header: t('Channel ID') },
    { accessorKey: 'reason', header: t('Reason') },
    {
      accessorKey: 'expires_at',
      header: t('Expiration time'),
      cell: ({ row }) =>
        row.original.expires_at
          ? new Date(row.original.expires_at * 1000).toLocaleString(locale)
          : t('Permanent'),
    },
    {
      accessorKey: 'automatic',
      header: t('Source'),
      cell: ({ row }) =>
        row.original.automatic ? t('Automatic') : t('Manual'),
    },
    {
      id: 'actions',
      header: t('Actions'),
      cell: ({ row }) => (
        <div className='flex gap-2'>
          <Button
            size='sm'
            variant='outline'
            disabled={!canRestrict || Boolean(row.original.released_at)}
            onClick={() => setEditing(row.original)}
          >
            {t('Edit')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            disabled={!canRestrict || Boolean(row.original.released_at)}
            onClick={() => setReleasing(row.original)}
          >
            {t('Release restriction')}
          </Button>
          {row.original.source_task_id > 0 && (
            <Button
              size='sm'
              variant='ghost'
              disabled={!canView}
              onClick={() => setRecord(row.original.source_task_id)}
            >
              {t('Source record')}
            </Button>
          )}
        </div>
      ),
    },
  ]
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap justify-between gap-3'>
        <NativeSelect
          aria-label={t('Status')}
          value={state}
          onChange={(e) => {
            setState(e.target.value)
            setPagination((value) => ({ ...value, pageIndex: 0 }))
          }}
        >
          <NativeSelectOption value='active'>{t('Active')}</NativeSelectOption>
          <NativeSelectOption value='expired'>
            {t('Expired')}
          </NativeSelectOption>
          <NativeSelectOption value='released'>
            {t('Released')}
          </NativeSelectOption>
          <NativeSelectOption value=''>{t('All')}</NativeSelectOption>
        </NativeSelect>
        <Button disabled={!canRestrict} onClick={() => setEditing({})}>
          {t('Add restriction')}
        </Button>
      </div>
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
      {editing && (
        <RestrictionEditor
          restriction={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {record !== null && (
        <ModerationDetail id={record} onClose={() => setRecord(null)} />
      )}
      <ConfirmDialog
        open={Boolean(releasing)}
        onOpenChange={(open) => {
          if (!open) setReleasing(null)
        }}
        title={t('Release restriction')}
        desc={t(
          'Old evidence will not immediately recreate an automatic restriction after release.'
        )}
        isLoading={release.isPending}
        handleConfirm={() => {
          if (releasing) {
            release.mutate(
              { ...releasing, release: true, expires_at: 0 },
              { onSuccess: () => setReleasing(null) }
            )
          }
        }}
      />
    </div>
  )
}
