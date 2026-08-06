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
import { after, describe, test } from 'node:test'

import { Window } from 'happy-dom'
import type React from 'react'

import type { TokenPeakRankingEntry } from '../../types'

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

Object.defineProperty(domWindow, 'matchMedia', {
  configurable: true,
  value: () => ({
    addEventListener() {},
    matches: true,
    removeEventListener() {},
  }),
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
        "Today's Hall of Glory": "Today's Hall of Glory",
        'Waiting for challenger': 'Waiting for challenger',
        You: 'You',
      },
    },
  },
})

const { LeaderboardSection } = await import('../leaderboard-section')
const { GloryPodium } = await import('../glory-podium')
const { MyPerformanceCard } = await import('../my-performance-card')
const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

const rankings: TokenPeakRankingEntry[] = [
  { position: 1, ranking_name: 'AuroraAPI', total_tokens: 9_842_310 },
  { position: 2, ranking_name: 'QuantumFlow', total_tokens: 8_156_880 },
  { position: 3, ranking_name: 'PixelPilot', total_tokens: 7_903_221 },
  { position: 4, ranking_name: 'FourthPlace', total_tokens: 6_840_119 },
]

async function renderElement(element: React.ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(<I18nextProvider i18n={i18n}>{element}</I18nextProvider>)
  })

  return { container, root }
}

describe('token peak leaderboard', () => {
  after(() => {
    domWindow.close()
  })

  test('renders every ranking in one list and identifies the current user', async () => {
    const rendered = await renderElement(
      <LeaderboardSection rankings={rankings} currentPosition={4} />
    )
    const lists = rendered.container.querySelectorAll('ol')

    assert.equal(lists.length, 1)
    assert.deepEqual(
      [...lists[0].children].map((item) =>
        item.querySelector('p')?.textContent?.trim()
      ),
      ['AuroraAPI', 'QuantumFlow', 'PixelPilot', 'FourthPlace']
    )
    const currentRow = rendered.container.querySelector('[aria-current="true"]')
    assert.match(currentRow?.textContent ?? '', /FourthPlace/)
    assert.match(currentRow?.textContent ?? '', /You/)

    await act(async () => rendered.root.unmount())
    rendered.container.remove()
  })

  test('keeps three podium slots visible when ranking data is incomplete', async () => {
    const rendered = await renderElement(
      <GloryPodium rankings={rankings.slice(0, 1)} />
    )
    const podium = rendered.container.querySelector('ol')

    assert.equal(podium?.children.length, 3)
    assert.match(podium?.textContent ?? '', /AuroraAPI/)
    assert.equal(
      [...rendered.container.querySelectorAll('li')].filter((item) =>
        item.textContent?.includes('Waiting for challenger')
      ).length,
      2
    )

    await act(async () => rendered.root.unmount())
    rendered.container.remove()
  })

  test('shows challenge progress from recorded tokens and the backend gap', async () => {
    const rendered = await renderElement(
      <MyPerformanceCard
        performance={{
          current_position: null,
          total_tokens: 400,
          tokens_to_rank: 100,
          target_position: 10,
        }}
      />
    )
    const progress = rendered.container.querySelector('[data-slot="progress"]')

    assert.equal(progress?.getAttribute('aria-valuenow'), '80')
    assert.match(rendered.container.textContent ?? '', /100 Token/)

    await act(async () => rendered.root.unmount())
    rendered.container.remove()
  })
})
