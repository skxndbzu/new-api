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

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { ImageResults } = await import('../image-results')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'Generated image': 'Generated image',
        Failed: 'Failed',
        Prompt: 'Prompt',
        Progress: 'Progress',
        'Revised prompt': 'Revised prompt',
        Succeeded: 'Succeeded',
        Total: 'Total',
        'Open image': 'Open image',
        'Download image': 'Download image',
        Duration: 'Duration',
        '{{value}}ms': '{{value}}ms',
        '{{value}}s': '{{value}}s',
      },
    },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

describe('drawing image results', () => {
  after(() => domWindow.close())

  test('renders every image and keeps both actions reachable', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const results = Array.from({ length: 5 }, (_, index) => ({
      resultId: `request-${index}`,
      url: `https://example.com/${index}.png`,
      prompt: `submitted prompt ${index}`,
      revised_prompt: `revised prompt ${index}`,
    }))

    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <ImageResults
            results={results}
            isSubmitting={false}
            onDownload={() => undefined}
          />
        </I18nextProvider>
      )
    })

    assert.equal(container.querySelectorAll('[data-drawing-image]').length, 5)
    assert.equal(container.querySelectorAll('[data-image-actions]').length, 5)
    assert.equal(container.querySelectorAll('a[target="_blank"]').length, 5)
    assert.equal(container.querySelectorAll('button').length, 10)
    assert.match(container.textContent ?? '', /revised prompt 0/)
    assert.doesNotMatch(container.textContent ?? '', /submitted prompt 0/)

    await act(async () => root.unmount())
    container.remove()
  })

  test('does not render an open action when an image has no URL', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <ImageResults
            results={[
              {
                resultId: 'request-base64',
                b64_json: 'final-image',
                prompt: 'preserved prompt',
                revised_prompt: 'upstream refined prompt',
              },
            ]}
            isSubmitting={false}
            onDownload={() => undefined}
          />
        </I18nextProvider>
      )
    })

    assert.equal(container.querySelector('a[target="_blank"]'), null)
    assert.doesNotMatch(container.textContent ?? '', /Open image/)
    assert.match(container.textContent ?? '', /upstream refined prompt/)
    assert.doesNotMatch(container.textContent ?? '', /preserved prompt/)

    await act(async () => root.unmount())
    container.remove()
  })

  test('falls back to the submitted prompt when no revised prompt is returned', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <ImageResults
            results={[
              {
                resultId: 'request-without-revised-prompt',
                b64_json: 'final-image',
                prompt: 'submitted fallback prompt',
              },
            ]}
            isSubmitting={false}
            onDownload={() => undefined}
          />
        </I18nextProvider>
      )
    })

    assert.match(container.textContent ?? '', /submitted fallback prompt/)

    await act(async () => root.unmount())
    container.remove()
  })

  test('shows generation counts and elapsed time', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <ImageResults
            results={[]}
            isSubmitting
            progress={{
              total: 5,
              succeeded: 2,
              failed: 1,
              elapsedMs: 1500,
            }}
            onDownload={() => undefined}
          />
        </I18nextProvider>
      )
    })

    assert.ok(container.querySelector('[data-slot="progress"]'))
    assert.match(container.textContent ?? '', /Total\s*5/)
    assert.match(container.textContent ?? '', /Succeeded\s*2/)
    assert.match(container.textContent ?? '', /Failed\s*1/)
    assert.match(container.textContent ?? '', /Duration\s*1.5s/)
    assert.match(container.textContent ?? '', /60%/)

    await act(async () => root.unmount())
    container.remove()
  })
})
