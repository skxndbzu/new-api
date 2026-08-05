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
        CHAMPION: 'CHAMPION',
        'RUNNER-UP': 'RUNNER-UP',
        'THIRD PLACE': 'THIRD PLACE',
      },
    },
  },
})

const { LeaderboardSection } = await import('../leaderboard-section')
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

async function renderLeaderboard(
  props: React.ComponentProps<typeof LeaderboardSection>
) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <LeaderboardSection {...props} />
      </I18nextProvider>
    )
  })

  return { container, root }
}

describe('token peak leaderboard', () => {
  after(() => {
    domWindow.close()
  })

  test('separates the top three into an ordered podium before remaining entries', async () => {
    const rendered = await renderLeaderboard({ rankings })
    const lists = rendered.container.querySelectorAll('ol')

    assert.equal(lists.length, 2)
    assert.deepEqual(
      [...lists[0].children].map((item) =>
        item.querySelector('p')?.textContent?.trim()
      ),
      ['AuroraAPI', 'QuantumFlow', 'PixelPilot']
    )
    assert.match(lists[0].textContent ?? '', /CHAMPION/)
    assert.match(lists[0].textContent ?? '', /RUNNER-UP/)
    assert.match(lists[0].textContent ?? '', /THIRD PLACE/)
    assert.match(lists[1].textContent ?? '', /FourthPlace/)

    await act(async () => rendered.root.unmount())
    rendered.container.remove()
  })
})
