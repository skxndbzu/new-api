import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import {
  moderationGet,
  moderationKey,
  useModerationMutation,
  useModerationPermission,
} from './api'
import { RestrictionEditor } from './restriction-editor'
import { statusLabel } from './status'
import type { Detail, Restriction } from './types'

export function ModerationDetail(props: { id: number; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [action, setAction] = useState('')
  const [note, setNote] = useState('')
  const [restriction, setRestriction] = useState<Partial<Restriction> | null>(
    null
  )
  const canReview = useModerationPermission('review')
  const canRestrict = useModerationPermission('restrict')
  const detail = useQuery({
    queryKey: [...moderationKey, 'detail', props.id],
    queryFn: () => moderationGet<Detail>(`/records/${props.id}`),
  })
  const review = useModerationMutation<{ verdict: string; note: string }>(
    `/records/${props.id}/review`
  )
  const requeue = useModerationMutation<Record<string, never>>(
    `/records/${props.id}/requeue`
  )
  const data = detail.data
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      title={t('Moderation record')}
      contentClassName='sm:max-w-5xl'
    >
      {detail.isPending && <LoadingState />}
      {detail.isError && <ErrorState onRetry={() => detail.refetch()} />}
      {data && (
        <div className='space-y-5'>
          <dl className='grid gap-2 text-sm sm:grid-cols-2'>
            <div>
              <dt>{t('Request ID')}</dt>
              <dd className='font-mono break-all'>{data.task.request_id}</dd>
            </div>
            <div>
              <dt>
                {t('Policy ID')} / {t('Version')}
              </dt>
              <dd>
                {data.task.policy_id} / {data.task.version}
              </dd>
            </div>
            <div>
              <dt>{t('Status')}</dt>
              <dd>
                {statusLabel(data.task.status, t)} · {data.task.error}
              </dd>
            </div>
            <div>
              <dt>
                {t('Machine verdict')} / {t('Human verdict')}
              </dt>
              <dd>
                {statusLabel(data.task.verdict, t)} /{' '}
                {statusLabel(data.task.human_verdict, t)}
              </dd>
            </div>
            <div>
              <dt>
                {t('Input tokens')} / {t('Output tokens')}
              </dt>
              <dd>
                {formatNumber(data.task.input_tokens, locale)} /{' '}
                {formatNumber(data.task.output_tokens, locale)}
              </dd>
            </div>
          </dl>
          {data.task.unknown_usage > 0 && (
            <p>
              {t('Calls with unknown usage')}:{' '}
              {formatNumber(data.task.unknown_usage, locale)}
            </p>
          )}
          <div className='flex flex-wrap gap-2'>
            <Button
              disabled={!canReview}
              onClick={() => setAction('violation')}
            >
              {t('Confirm violation')}
            </Button>
            <Button
              variant='outline'
              disabled={!canReview}
              onClick={() => setAction('safe')}
            >
              {t('Mark false positive')}
            </Button>
            <Button
              variant='outline'
              disabled={!canReview || !data.content}
              onClick={() => setAction('requeue')}
            >
              {t('Review again')}
            </Button>
            <Button
              variant='destructive'
              disabled={!canRestrict || data.task.is_test}
              onClick={() =>
                setRestriction({
                  subject: 'user',
                  subject_id: data.task.user_id,
                  channel_id: data.task.channel_id,
                  source_task_id: data.task.id,
                })
              }
            >
              {t('Restrict future requests')}
            </Button>
          </div>
          {data.content ? (
            <section className='space-y-3'>
              <h2 className='font-semibold'>
                {t('Coverage')}:{' '}
                {data.content.coverage.complete ? t('Complete') : t('Partial')}
              </h2>
              <p className='text-muted-foreground text-sm break-all'>
                {data.content.coverage.reasons
                  ?.map((reason) => statusLabel(reason, t))
                  .join(', ')}
              </p>
              <p className='text-sm'>
                {t('Scanned / reviewed bytes')}:{' '}
                {formatNumber(data.content.coverage.scanned_bytes, locale)} /{' '}
                {formatNumber(data.content.coverage.reviewed_bytes, locale)}
              </p>
              <p>
                {t('Keyword matches')}: {data.content.hits.join(', ') || '—'}
              </p>
              {data.content.messages.map((message) => (
                <article key={message.index} className='rounded-lg border p-3'>
                  <p className='mb-2 font-medium'>
                    #{message.index} · {statusLabel(message.role, t)}
                  </p>
                  <pre className='max-h-72 overflow-auto font-sans text-sm break-words whitespace-pre-wrap'>
                    {message.text}
                  </pre>
                </article>
              ))}
            </section>
          ) : (
            <p>{t('Moderation content has expired.')}</p>
          )}
          <section className='space-y-3'>
            <h2 className='font-semibold'>{t('Review history')}</h2>
            {data.history.map((entry) => (
              <article
                key={entry.id}
                className='space-y-2 rounded-lg border p-3'
              >
                <p>
                  {statusLabel(entry.kind, t)} · {statusLabel(entry.verdict, t)}{' '}
                  · {new Date(entry.created_at * 1000).toLocaleString(locale)}
                </p>
                <p className='text-muted-foreground text-xs break-all'>
                  {entry.model} · #{entry.channel_id} · {entry.fingerprint}
                </p>
                <p className='whitespace-pre-wrap'>
                  {entry.detail?.reason ?? entry.detail?.note}
                </p>
                {entry.detail?.evidence?.map((evidence) => (
                  <blockquote
                    key={`${evidence.message_index}:${evidence.quote}`}
                    className='border-l-2 pl-3 text-sm whitespace-pre-wrap'
                  >
                    #{evidence.message_index}: {evidence.quote}
                  </blockquote>
                ))}
              </article>
            ))}
          </section>
          <section>
            <h2 className='font-semibold'>{t('Channel attempts')}</h2>
            <p className='text-muted-foreground text-sm'>
              {t(
                'Selected means a relay attempt was selected; it does not prove the upstream received the request.'
              )}
            </p>
            {data.channel_attempts.map((attempt) => (
              <p key={attempt.id}>
                #{attempt.number} · {t('Channel')} #{attempt.channel_id} ·{' '}
                {statusLabel(attempt.outcome, t)} · {attempt.status_code || '—'}
              </p>
            ))}
          </section>
          <ConfirmDialog
            open={Boolean(action)}
            onOpenChange={(open) => {
              if (!open) setAction('')
            }}
            title={t('Confirm moderation action')}
            desc={t(
              'Human decisions are preserved when a record is reviewed again. Correcting a false positive revokes only related automatic restrictions.'
            )}
            isLoading={review.isPending || requeue.isPending}
            handleConfirm={() => {
              if (action === 'requeue') {
                requeue.mutate({}, { onSuccess: () => setAction('') })
              } else {
                review.mutate(
                  { verdict: action, note },
                  { onSuccess: () => setAction('') }
                )
              }
            }}
          >
            <Label htmlFor='review-note'>{t('Note')}</Label>
            <Textarea
              id='review-note'
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
            />
          </ConfirmDialog>
          {restriction && (
            <RestrictionEditor
              restriction={restriction}
              onClose={() => setRestriction(null)}
            />
          )}
        </div>
      )}
    </Dialog>
  )
}
