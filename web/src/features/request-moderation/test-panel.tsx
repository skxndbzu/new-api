import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import { moderationGet, moderationKey, useModerationPermission } from './api'
import { statusLabel } from './status'
import type { Content, Detail, ModerationTask, Policy } from './types'

export function ModerationTest(props: { getPolicy: () => Policy }) {
  const { t } = useTranslation()
  const [body, setBody] = useState(
    '{"messages":[{"role":"user","content":"Explain defensive security testing"}]}'
  )
  const canViewBody = useModerationPermission('body')
  const test = useMutation({
    mutationFn: async (modelCall: boolean) => {
      const response = await api.post<{
        success: boolean
        data: {
          content: Content
          selection: string
          task: ModerationTask | null
        }
      }>('/api/request_moderation/test', {
        policy: props.getPolicy(),
        body,
        model_call: modelCall,
      })
      return requireServerSuccess(response.data).data
    },
  })
  const id = test.data?.task?.id
  const result = useQuery({
    queryKey: [...moderationKey, 'test', id],
    queryFn: () => moderationGet<Detail>(`/records/${id}`),
    enabled: Boolean(id) && canViewBody,
    refetchInterval: (query) =>
      ['completed', 'failed', 'expired'].includes(
        query.state.data?.task.status ?? ''
      )
        ? false
        : 2000,
  })
  return (
    <div className='mt-5 space-y-3 border-t pt-4'>
      <Label htmlFor='moderation-test-body'>{t('Test request JSON')}</Label>
      <Textarea
        id='moderation-test-body'
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className='min-h-32 font-mono text-sm'
      />
      <div className='flex flex-wrap gap-2'>
        <Button
          variant='outline'
          disabled={test.isPending}
          onClick={() => test.mutate(false)}
        >
          {t('Test selection rules')}
        </Button>
        <Button disabled={test.isPending} onClick={() => test.mutate(true)}>
          {t('Test review model')}
        </Button>
      </div>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Model tests consume the shared review budget and never create restrictions.'
        )}
      </p>
      {test.data && (
        <p>
          {statusLabel(test.data.selection, t)}
          {' · '}
          {t('Keyword matches')}: {test.data.content.hits.join(', ') || '—'}
        </p>
      )}
      {result.data && (
        <div className='space-y-2'>
          <p>
            {statusLabel(result.data.task.status, t)}
            {' · '}
            {statusLabel(result.data.task.verdict, t)}
          </p>
          <p>{result.data.task.error}</p>
          {result.data.history.map((entry) => (
            <p key={entry.id}>{entry.detail?.reason}</p>
          ))}
        </div>
      )}
      {id && !canViewBody && (
        <p>
          {t('Queued for review')} #{id}
        </p>
      )}
    </div>
  )
}
