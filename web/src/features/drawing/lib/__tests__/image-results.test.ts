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
import { describe, test } from 'node:test'

import {
  calculateCenterCrop,
  centerCropImageResults,
  createDrawingResults,
  createDrawingResultsFromResponses,
  createImageRequests,
  DRAWING_ASPECT_RATIO_OPTIONS,
  getImageSrc,
  MAX_DRAWING_IMAGE_COUNT,
  normalizeImageCount,
} from '../image-results'

const requestDefaults = {
  model: 'gpt-image-2',
  group: 'images',
  prompt: 'draw five cards',
  quality: 'auto' as const,
  aspectRatio: 'auto' as const,
}

describe('drawing image requests and results', () => {
  test('offers the supported aspect ratios in display order', () => {
    assert.deepEqual(
      DRAWING_ASPECT_RATIO_OPTIONS.map(({ value }) => value),
      [
        '1:1',
        '2:3',
        '3:2',
        '3:4',
        '4:3',
        '9:16',
        '16:9',
        '4:5',
        '5:4',
        '1:2',
        '2:1',
      ]
    )
  })

  test('creates one compatible request per selected image', () => {
    const requests = createImageRequests({
      ...requestDefaults,
      mode: 'generate',
      imageCount: 5,
    })

    assert.equal(requests.length, 5)
    assert.deepEqual(
      requests.map((request) => request.n),
      [1, 1, 1, 1, 1]
    )
    assert.equal(requests[0].prompt, 'draw five cards')
  })

  test('adds the selected aspect ratio to generate and edit prompts', () => {
    for (const mode of ['generate', 'edit'] as const) {
      const requests = createImageRequests({
        ...requestDefaults,
        mode,
        aspectRatio: '16:9',
        imageCount: 1,
      })

      assert.equal(requests[0].prompt, 'draw five cards，图片比例为16:9')
    }
  })

  test('calculates an exact centered 16:9 crop for an approximate image', () => {
    assert.deepEqual(calculateCenterCrop(1672, 941, '16:9'), {
      sourceX: 4,
      sourceY: 2.5,
      sourceWidth: 1664,
      sourceHeight: 936,
    })
  })

  test('center crops a returned image and replaces its original URL', async () => {
    const originalImage = Object.getOwnPropertyDescriptor(globalThis, 'Image')
    const originalDocument = Object.getOwnPropertyDescriptor(
      globalThis,
      'document'
    )
    let canvasWidth = 0
    let canvasHeight = 0
    let drawArguments: unknown[] = []

    class TestImage {
      crossOrigin = ''
      naturalWidth = 1672
      naturalHeight = 941
      loadListener: (() => void) | null = null

      addEventListener(type: string, listener: () => void) {
        if (type === 'load') this.loadListener = listener
      }

      set src(_value: string) {
        this.loadListener?.()
      }
    }

    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      value: TestImage,
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: () => ({
          get width() {
            return canvasWidth
          },
          set width(value: number) {
            canvasWidth = value
          },
          get height() {
            return canvasHeight
          },
          set height(value: number) {
            canvasHeight = value
          },
          getContext: () => ({
            drawImage: (...args: unknown[]) => {
              drawArguments = args
            },
          }),
          toDataURL: () => 'data:image/png;base64,cropped-image',
        }),
      },
    })

    try {
      const results = await centerCropImageResults(
        [
          {
            url: 'https://example.com/generated.png',
            revised_prompt: '精修后的提示词',
          },
        ],
        '16:9'
      )

      assert.equal(canvasWidth, 1664)
      assert.equal(canvasHeight, 936)
      assert.deepEqual(drawArguments.slice(1, 5), [4, 2.5, 1664, 936])
      assert.deepEqual(results, [
        {
          b64_json: 'cropped-image',
          revised_prompt: '精修后的提示词',
        },
      ])
    } finally {
      if (originalImage) {
        Object.defineProperty(globalThis, 'Image', originalImage)
      } else {
        Reflect.deleteProperty(globalThis, 'Image')
      }
      if (originalDocument) {
        Object.defineProperty(globalThis, 'document', originalDocument)
      } else {
        Reflect.deleteProperty(globalThis, 'document')
      }
    }
  })

  test('does not process returned images when aspect ratio is automatic', async () => {
    const images = [{ b64_json: 'original-image' }]

    assert.equal(await centerCropImageResults(images, 'auto'), images)
  })

  test('explicitly limits edit requests to one output image', () => {
    const requests = createImageRequests({
      ...requestDefaults,
      mode: 'edit',
      imageCount: 5,
    })

    assert.equal(requests.length, 1)
    assert.equal(requests[0].n, 1)
  })

  test('keeps every item returned by a multi-image response', () => {
    const response = Array.from({ length: 5 }, (_, index) => ({
      url: `https://example.com/${index}.png`,
    }))

    const results = createDrawingResults(response, 'request-1')

    assert.equal(results.length, 5)
    assert.deepEqual(
      results.map((result) => result.resultId),
      Array.from({ length: 5 }, (_, index) => `request-1-${index}`)
    )
  })

  test('keeps one final image from each single-output request', () => {
    const results = createDrawingResultsFromResponses(
      [
        {
          responseId: 'request-1',
          data: [{ b64_json: 'image-1' }, { b64_json: 'image-2' }],
        },
        { responseId: 'request-2', data: [{ b64_json: 'image-3' }] },
      ],
      2
    )

    assert.deepEqual(
      results.map((result) => result.b64_json),
      ['image-1', 'image-3']
    )
  })

  test('uses Base64 data when the URL is present but empty', () => {
    assert.equal(
      getImageSrc({ url: '', b64_json: 'aW1hZ2U=' }),
      'data:image/png;base64,aW1hZ2U='
    )
  })

  test('normalizes counts to the shared backend range', () => {
    assert.equal(normalizeImageCount(0), 1)
    assert.equal(normalizeImageCount(5.8), 5)
    assert.equal(
      normalizeImageCount(MAX_DRAWING_IMAGE_COUNT + 1),
      MAX_DRAWING_IMAGE_COUNT
    )
  })
})
