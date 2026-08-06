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

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import {
  consumeImageGenerationSSE,
  editImage,
  generateImage,
  generateRequestedImages,
  ImageModelUnavailableError,
} from '../api'

function streamedResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } }
  )
}

function setDrawingTestAuth() {
  const auth = useAuthStore.getState().auth
  auth.setBundle({
    access_token: 'drawing-test-token',
    token_type: 'Bearer',
    access_expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 1, username: 'drawing-test', role: 1 },
    session: {
      sid: 'drawing-test-session',
      current: true,
      login_method: 'test',
      ip: '127.0.0.1',
      user_agent: 'test',
      created_at: 0,
      last_active_at: 0,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    },
  })
  return auth
}

describe('drawing image response', () => {
  test('asks generation requests to return the revised prompt in Chinese', async () => {
    const originalFetch = globalThis.fetch
    const auth = setDrawingTestAuth()
    let submittedPrompt = ''
    globalThis.fetch = async (_input, init) => {
      submittedPrompt = String(JSON.parse(String(init?.body)).prompt)
      return new Response(JSON.stringify({ data: [{ b64_json: 'image' }] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      await generateImage({
        model: 'gpt-image-2-codex',
        group: 'default',
        prompt: '生成一只可爱的猫',
        n: 1,
      })
    } finally {
      globalThis.fetch = originalFetch
      auth.reset()
    }

    assert.match(submittedPrompt, /^生成一只可爱的猫/)
    assert.match(submittedPrompt, /精修提示词.*简体中文/)
  })

  test('asks edit requests to return the revised prompt in Chinese', async () => {
    const originalPost = api.post
    let submittedPrompt = ''
    api.post = (async (_url, body) => {
      assert.ok(body instanceof FormData)
      submittedPrompt = String(body.get('prompt'))
      return { data: { data: [] } }
    }) as typeof api.post

    try {
      await editImage({
        model: 'gpt-image-2',
        group: 'default',
        prompt: '把背景改成花园',
        n: 1,
        image: new File(['image'], 'image.png', { type: 'image/png' }),
      })
    } finally {
      api.post = originalPost
    }

    assert.match(submittedPrompt, /^把背景改成花园/)
    assert.match(submittedPrompt, /精修提示词.*简体中文/)
  })

  test('sends an edit prompt with its selected aspect ratio and no size', async () => {
    const originalPost = api.post
    let submittedPrompt = ''
    let submittedSize: FormDataEntryValue | null = null
    api.post = (async (_url, body) => {
      assert.ok(body instanceof FormData)
      submittedPrompt = String(body.get('prompt'))
      submittedSize = body.get('size')
      return { data: { data: [] } }
    }) as typeof api.post

    try {
      await editImage({
        model: 'gpt-image-2',
        group: 'default',
        prompt: 'edit this image\n\n图片比例为4:5',
        n: 1,
        image: new File(['image'], 'image.png', { type: 'image/png' }),
      })
    } finally {
      api.post = originalPost
    }

    assert.match(submittedPrompt, /图片比例为4:5/)
    assert.equal(submittedSize, null)
  })

  test('maps an unavailable edit model to a drawing-specific error', async () => {
    const originalPost = api.post
    api.post = (() =>
      Promise.reject({
        isAxiosError: true,
        message: 'Request failed with status code 503',
        response: {
          status: 503,
          data: {
            error: {
              code: 'model_not_found',
              message:
                '分组 default 下模型 gpt-image-2 无可用渠道（distributor）',
            },
          },
        },
      })) as typeof api.post

    try {
      await assert.rejects(
        editImage({
          model: 'gpt-image-2',
          group: 'default',
          prompt: 'edit this image',
          n: 1,
          image: new File(['image'], 'image.png', { type: 'image/png' }),
        }),
        ImageModelUnavailableError
      )
    } finally {
      api.post = originalPost
    }
  })

  test('requests final JSON images and preserves the revised prompt', async () => {
    const originalFetch = globalThis.fetch
    const auth = setDrawingTestAuth()

    let requestUrl = ''
    let requestBody = ''
    let requestHeaders = new Headers()
    globalThis.fetch = async (input, init) => {
      requestUrl = String(input)
      requestBody = String(init?.body ?? '')
      requestHeaders = new Headers(init?.headers)
      return new Response(
        JSON.stringify({
          data: [
            {
              b64_json: 'final-image',
              revised_prompt: 'five illustrated cards',
            },
          ],
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    let response: Awaited<ReturnType<typeof generateImage>> | undefined
    try {
      response = await generateImage({
        model: 'gpt-image-2',
        group: 'default',
        prompt: 'draw five cards',
        quality: 'auto',
        n: 5,
      })
    } finally {
      globalThis.fetch = originalFetch
      auth.reset()
    }

    assert.equal(requestUrl, '/pg/images/generations')
    assert.equal(JSON.parse(requestBody).n, 5)
    assert.equal(JSON.parse(requestBody).size, undefined)
    assert.equal(requestHeaders.get('Accept'), 'application/json')
    assert.equal(requestHeaders.get('X-New-Api-Image-Stream'), null)
    assert.equal(response?.data?.[0]?.revised_prompt, 'five illustrated cards')
  })

  test('runs at most four image requests concurrently', async () => {
    const originalFetch = globalThis.fetch
    const auth = setDrawingTestAuth()
    let activeRequestCount = 0
    let maximumActiveRequestCount = 0
    let startedRequestCount = 0
    let releaseFirstWave: (() => void) | undefined
    let markFirstWaveStarted: (() => void) | undefined
    const firstWaveStarted = new Promise<void>((resolve) => {
      markFirstWaveStarted = resolve
    })
    const firstWaveBlocked = new Promise<void>((resolve) => {
      releaseFirstWave = resolve
    })

    globalThis.fetch = async () => {
      startedRequestCount++
      activeRequestCount++
      maximumActiveRequestCount = Math.max(
        maximumActiveRequestCount,
        activeRequestCount
      )
      if (startedRequestCount === 4) markFirstWaveStarted?.()
      if (startedRequestCount <= 4) await firstWaveBlocked
      activeRequestCount--
      return new Response(JSON.stringify({ data: [{ b64_json: 'image' }] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      const responsePromise = generateRequestedImages(
        Array.from({ length: 6 }, () => ({
          model: 'gpt-image-2',
          prompt: 'six dogs',
          n: 1,
        }))
      )
      await firstWaveStarted
      assert.equal(startedRequestCount, 4)
      releaseFirstWave?.()
      const responses = await responsePromise

      assert.equal(responses.length, 6)
    } finally {
      globalThis.fetch = originalFetch
      auth.reset()
    }

    assert.equal(maximumActiveRequestCount, 4)
  })

  test('retries each failed request once without discarding other results', async () => {
    const originalFetch = globalThis.fetch
    const auth = setDrawingTestAuth()
    const requestCounts = new Map<string, number>()
    globalThis.fetch = async (_input, init) => {
      const prompt = String(JSON.parse(String(init?.body)).prompt).split(
        '\n\n',
        1
      )[0]
      const requestCount = (requestCounts.get(prompt) ?? 0) + 1
      requestCounts.set(prompt, requestCount)

      if (prompt === 'always fails' || requestCount === 1) {
        return new Response(JSON.stringify({ error: { message: 'failed' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ data: [{ b64_json: prompt }] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let responses: Awaited<ReturnType<typeof generateRequestedImages>> = []
    const failedRequestIndexes: number[] = []
    try {
      responses = await generateRequestedImages(
        [
          { model: 'gpt-image-2', prompt: 'always fails', n: 1 },
          { model: 'gpt-image-2', prompt: 'retry succeeds', n: 1 },
          { model: 'gpt-image-2', prompt: 'also retry succeeds', n: 1 },
        ],
        {
          onFailure: (requestIndex) => {
            failedRequestIndexes.push(requestIndex)
          },
        }
      )
    } finally {
      globalThis.fetch = originalFetch
      auth.reset()
    }

    assert.equal(requestCounts.get('always fails'), 2)
    assert.equal(requestCounts.get('retry succeeds'), 2)
    assert.equal(requestCounts.get('also retry succeeds'), 2)
    assert.deepEqual(
      responses.map((response) => response.data?.[0]?.b64_json),
      ['retry succeeds', 'also retry succeeds']
    )
    assert.deepEqual(failedRequestIndexes, [0])
  })

  test('reports successful responses before the whole batch finishes', async () => {
    const originalFetch = globalThis.fetch
    const auth = setDrawingTestAuth()
    let releaseSlowRequest: (() => void) | undefined
    const slowRequestBlocked = new Promise<void>((resolve) => {
      releaseSlowRequest = resolve
    })
    let markFastRequestCompleted: (() => void) | undefined
    const fastRequestCompleted = new Promise<void>((resolve) => {
      markFastRequestCompleted = resolve
    })

    globalThis.fetch = async (_input, init) => {
      const prompt = String(JSON.parse(String(init?.body)).prompt).split(
        '\n\n',
        1
      )[0]
      if (prompt === 'slow') await slowRequestBlocked
      return new Response(JSON.stringify({ data: [{ b64_json: prompt }] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const completedRequestIndexes: number[] = []
    try {
      const responsePromise = generateRequestedImages(
        [
          { model: 'gpt-image-2', prompt: 'slow', n: 1 },
          { model: 'gpt-image-2', prompt: 'fast', n: 1 },
        ],
        {
          onResponse: (_response, requestIndex) => {
            completedRequestIndexes.push(requestIndex)
            if (requestIndex === 1) markFastRequestCompleted?.()
          },
        }
      )

      await fastRequestCompleted
      assert.deepEqual(completedRequestIndexes, [1])
      releaseSlowRequest?.()
      await responsePromise
    } finally {
      globalThis.fetch = originalFetch
      auth.reset()
    }

    assert.deepEqual(completedRequestIndexes, [1, 0])
  })

  test('preserves all five completed images across split chunks', async () => {
    const frames = Array.from(
      { length: 5 },
      (_, index) =>
        `event: image_generation.completed\ndata: ${JSON.stringify({ type: 'image_generation.completed', b64_json: `image-${index}` })}\n\n`
    ).join('')
    const splitAt = Math.floor(frames.length / 2)
    const completedIndexes: number[] = []

    const response = await consumeImageGenerationSSE(
      streamedResponse([
        frames.slice(0, splitAt),
        `${frames.slice(splitAt)}data: [DONE]\n\n`,
      ]),
      'request-5',
      {
        onCompleted: ({ imageIndex }) => completedIndexes.push(imageIndex),
      }
    )

    assert.equal(response.data?.length, 5)
    assert.deepEqual(
      response.data?.map((image) => image.b64_json),
      Array.from({ length: 5 }, (_, index) => `image-${index}`)
    )
    assert.deepEqual(completedIndexes, [0, 1, 2, 3, 4])
  })

  test('reports a partial image without adding it to completed results', async () => {
    const partials: string[] = []
    const response = await consumeImageGenerationSSE(
      streamedResponse([
        'data: {"type":"image_generation.partial_image","b64_json":"partial"}\n\n',
        'data: {"type":"image_generation.completed","b64_json":"final"}\n\n',
        'data: [DONE]\n\n',
      ]),
      'request-partial',
      {
        onPartial: ({ image }) => partials.push(image.b64_json ?? ''),
      }
    )

    assert.deepEqual(partials, ['partial'])
    assert.deepEqual(response.data, [{ b64_json: 'final' }])
  })
})
