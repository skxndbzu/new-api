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
  'HTMLInputElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'ResizeObserver',
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
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { Drawing } = await import('../index')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

async function changeInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      domWindow.HTMLInputElement.prototype,
      'value'
    )?.set
    assert.ok(valueSetter)
    valueSetter.call(input, value)
    input.dispatchEvent(
      new domWindow.Event('input', { bubbles: true }) as unknown as Event
    )
  })
}

async function renderDrawingForm() {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(
    ['drawing-models'],
    [{ label: 'gpt-image-2', value: 'gpt-image-2' }]
  )
  queryClient.setQueryData(
    ['drawing-groups'],
    [{ label: 'default', value: 'default', ratio: 1 }]
  )

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <Drawing />
        </I18nextProvider>
      </QueryClientProvider>
    )
  })

  return { container, queryClient, root }
}

describe('drawing form', () => {
  after(() => domWindow.close())

  test('allows clearing the image count before entering a replacement', async () => {
    const { container, queryClient, root } = await renderDrawingForm()

    const countInput = container.querySelector<HTMLInputElement>(
      '#drawing-image-count'
    )
    assert.ok(countInput)
    assert.equal(countInput.value, '1')

    await changeInput(countInput, '')
    assert.equal(countInput.value, '')

    await changeInput(countInput, '12')
    assert.equal(countInput.value, '12')

    await act(async () => root.unmount())
    queryClient.clear()
    container.remove()
  })

  test('shows an optional aspect ratio selector', async () => {
    const { container, queryClient, root } = await renderDrawingForm()

    const aspectRatioTrigger = container.querySelector('#drawing-aspect-ratio')
    assert.ok(aspectRatioTrigger)
    assert.match(aspectRatioTrigger.textContent ?? '', /Auto/)

    await act(async () => root.unmount())
    queryClient.clear()
    container.remove()
  })
})
