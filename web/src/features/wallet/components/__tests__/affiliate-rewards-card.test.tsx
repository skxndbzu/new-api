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
import assert from 'node:assert/strict'
import { afterAll as after, describe, test } from 'vitest'

import { Window } from 'happy-dom'
import type React from 'react'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const copiedValues: string[] = []
Object.defineProperty(domWindow.navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: async (value: string) => {
      copiedValues.push(value)
    },
  },
})

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'Referral Program': 'Referral Program',
        'Invite friends and earn referral rewards':
          'Invite friends and earn referral rewards',
        'Earn rewards when friends register and top up through your referral link.':
          'Earn rewards when friends register and top up through your referral link.',
        'Total referral earnings': 'Total referral earnings',
        Pending: 'Pending',
        'Successful invites': 'Successful invites',
        '{{count}} people': '{{count}} people',
        'My referral link': 'My referral link',
        'Rewards are credited automatically when friends register and top up.':
          'Rewards are credited automatically when friends register and top up.',
        'Copy referral link': 'Copy referral link',
        'Copied to clipboard': 'Copied to clipboard',
        'Failed to copy to clipboard': 'Failed to copy to clipboard',
        Copied: 'Copied',
        'Copied!': 'Copied!',
        'Transfer to Balance': 'Transfer to Balance',
      },
    },
  },
})

const { AffiliateRewardsCard } = await import('../affiliate-rewards-card')
const { formatQuota } = await import('@/lib/format')
const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type RenderedCard = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

const user = {
  id: 7,
  username: 'referrer',
  quota: 0,
  used_quota: 0,
  request_count: 0,
  aff_quota: 500_000,
  aff_history_quota: 1_500_000,
  aff_count: 3,
  group: 'default',
}

async function renderCard(
  props?: Partial<React.ComponentProps<typeof AffiliateRewardsCard>>
): Promise<RenderedCard> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <AffiliateRewardsCard
          user={user}
          affiliateLink='https://example.com/register?aff=demo'
          onTransfer={() => undefined}
          {...props}
        />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmountCard(rendered: RenderedCard) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

describe('affiliate rewards card', () => {
  after(() => {
    domWindow.close()
  })

  test('presents referral earnings as an activity with three prominent metrics', async () => {
    const rendered = await renderCard()
    const text = rendered.container.textContent ?? ''

    assert.equal(
      text.includes('Invite friends and earn referral rewards'),
      true
    )
    assert.equal(text.includes('Total referral earnings'), true)
    assert.equal(text.includes(formatQuota(user.aff_history_quota)), true)
    assert.equal(text.includes('Pending'), true)
    assert.equal(text.includes(formatQuota(user.aff_quota)), true)
    assert.equal(text.includes('Successful invites'), true)
    assert.equal(text.includes('3 people'), true)

    const stats = rendered.container.querySelector('[data-referral-stats]')
    assert.ok(stats)
    assert.equal(stats.classList.contains('grid-cols-1'), true)
    assert.equal(
      stats.classList.contains('sm:grid-cols-[1fr_auto_1fr_auto_1fr]'),
      true
    )

    await unmountCard(rendered)
  })

  test('keeps the referral link readable and confirms the copy action', async () => {
    const rendered = await renderCard()
    const input =
      rendered.container.querySelector<HTMLInputElement>('#affiliate-link')
    const copyButton = rendered.container.querySelector<HTMLButtonElement>(
      'button[aria-label="Copy referral link"]'
    )
    const actions = rendered.container.querySelector(
      '[data-referral-link-actions]'
    )

    assert.equal(input?.value, 'https://example.com/register?aff=demo')
    assert.ok(copyButton)
    assert.ok(actions)
    assert.equal(actions.classList.contains('flex-col'), true)
    assert.equal(actions.classList.contains('sm:flex-row'), true)
    const transferButton = [
      ...rendered.container.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent?.includes('Transfer to Balance'))
    assert.equal(transferButton?.disabled, false)

    await act(async () => {
      copyButton.click()
      await Promise.resolve()
    })

    assert.deepEqual(copiedValues, ['https://example.com/register?aff=demo'])
    assert.ok(rendered.container.querySelector('button[aria-label="Copied"]'))

    await unmountCard(rendered)
  })
})
