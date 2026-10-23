import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { PolicyEditor } from '../policy-editor'
import { ModerationDetail } from '../record-detail'
import { ModerationRecords } from '../records'
import { RestrictionEditor } from '../restriction-editor'
import type { Policy } from '../types'

const clients: QueryClient[] = []
const policy: Policy = {
  id: 3,
  version: 2,
  name: 'Text review',
  enabled: true,
  channels: [7],
  models: [],
  keywords: ['attack'],
  sample_percent: 1,
  rules: 'Allow authorized testing',
  primary: { channel_id: 9, model: 'review-a', protocol: 'chat' },
  fallback: null,
  timeout_seconds: 30,
  retries: 2,
  auto_restrict: false,
  subject: 'user',
  window_hours: 24,
  violation_count: 3,
  min_severity: 'high',
  restriction_hours: 24,
}

beforeEach(() => {
  localStorage.clear()
  useAuthStore.getState().auth.setUser({ id: 1, username: 'root', role: 100 })
})
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear())
  useAuthStore.getState().auth.reset()
  localStorage.clear()
})
function renderManagement(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
  return client
}

it('clears an incompatible review model after channel selection and submits a validated policy', async () => {
  const user = userEvent.setup()
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true, data: policy } })
  const closed = vi.fn()
  renderManagement(
    <PolicyEditor
      policy={policy}
      channels={[
        {
          id: 7,
          name: 'Business',
          models: 'business',
          status: 1,
          review_supported: false,
        },
        {
          id: 9,
          name: 'Reviewer A',
          models: 'review-a',
          status: 1,
          review_supported: true,
        },
        {
          id: 10,
          name: 'Reviewer B',
          models: 'review-b',
          status: 1,
          review_supported: true,
        },
      ]}
      onClose={closed}
    />
  )
  await user.selectOptions(screen.getByLabelText('Channel'), '10')
  const model = screen.getByLabelText('Model')
  expect(model).toHaveValue('')
  expect(
    within(model).queryByRole('option', { name: 'review-a' })
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Check the moderation limits'
  )
  expect(put).not.toHaveBeenCalled()
  await user.selectOptions(model, 'review-b')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      '/api/request_moderation/policies',
      expect.objectContaining({
        id: 3,
        version: 2,
        primary: { channel_id: 10, model: 'review-b', protocol: 'chat' },
      })
    )
  )
  await waitFor(() => expect(closed).toHaveBeenCalled())
})

it('starts with pending human reviews and resets server pagination when filters change', async () => {
  const user = userEvent.setup()
  const get = vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: { items: [], total: 45, page: 1, size: 20 },
    },
  })
  renderManagement(<ModerationRecords />)
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith('/api/request_moderation/records', {
      params: { review_only: true, page: 1, size: 20 },
    })
  )
  await user.click(await screen.findByRole('button', { name: /next page/i }))
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith('/api/request_moderation/records', {
      params: { review_only: true, page: 2, size: 20 },
    })
  )
  await user.type(screen.getByLabelText('User ID'), '15')
  await user.click(screen.getByRole('checkbox', { name: 'Needs review only' }))
  await user.click(screen.getByRole('button', { name: 'Filter' }))
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith('/api/request_moderation/records', {
      params: { review_only: false, user_id: '15', page: 1, size: 20 },
    })
  )
})

it('requires confirmation before recording a human correction and refreshes its record', async () => {
  const user = userEvent.setup()
  const get = vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        task: {
          id: 1,
          request_id: 'server-id',
          policy_id: 3,
          version: 2,
          status: 'completed',
          verdict: 'violation',
          human_verdict: '',
          input_tokens: 10,
          output_tokens: 5,
          is_test: false,
          user_id: 15,
          channel_id: 7,
        },
        content: null,
        history: [],
        channel_attempts: [],
        policy,
      },
    },
  })
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true, data: null } })
  renderManagement(<ModerationDetail id={1} onClose={() => {}} />)
  expect(
    await screen.findByRole('button', { name: 'Review again' })
  ).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Mark false positive' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.type(
    within(dialog).getByLabelText('Note'),
    'Authorized security exercise'
  )
  expect(post).not.toHaveBeenCalled()
  await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/api/request_moderation/records/1/review',
      { verdict: 'safe', note: 'Authorized security exercise' }
    )
  )
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
})

it('requires confirmation for a channel restriction and preserves its source record', async () => {
  const user = userEvent.setup()
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true, data: null } })
  const closed = vi.fn()
  renderManagement(
    <RestrictionEditor
      restriction={{
        subject: 'token',
        subject_id: 19,
        channel_id: 7,
        source_task_id: 1,
      }}
      onClose={closed}
    />
  )
  await user.type(screen.getByLabelText('Reason'), 'Confirmed abuse')
  await user.click(screen.getByRole('button', { name: 'Save restriction' }))
  expect(post).not.toHaveBeenCalled()
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'Continue',
    })
  )
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/api/request_moderation/restrictions',
      expect.objectContaining({
        subject: 'token',
        subject_id: 19,
        channel_id: 7,
        source_task_id: 1,
        expires_at: 0,
        reason: 'Confirmed abuse',
      })
    )
  )
  await waitFor(() => expect(closed).toHaveBeenCalled())
})
