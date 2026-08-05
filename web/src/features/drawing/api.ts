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
import axios from 'axios'

import { api, getFreshAuthHeaders } from '@/lib/api'

import type {
  GroupOption,
  ImageGenerationProgress,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageResponse,
  ImageResult,
  ModelOption,
} from './types'

type ImageGenerationOptions = {
  signal?: AbortSignal
  onPartial?: (progress: ImageGenerationProgress) => void
  onCompleted?: (progress: ImageGenerationProgress) => void
  onResponse?: (
    response: ImageGenerationResponse,
    requestIndex: number
  ) => void | Promise<void>
  onFailure?: (requestIndex: number) => void
}

type ImageStreamEvent = ImageResult & {
  type?: string
  created_at?: number
  output_index?: number
  image_index?: number
  error?: { message?: string } | string
  message?: string
}

const CHINESE_REVISED_PROMPT_INSTRUCTION =
  '请将返回的精修提示词（revised_prompt）固定使用简体中文，不要使用英文；此要求仅约束返回提示词的语言，不改变图片内容。'

export class ImageStreamProtocolError extends Error {}
export class ImageModelUnavailableError extends Error {}

export async function getUserModels(): Promise<ModelOption[]> {
  const res = await api.get('/api/user/models')
  const { data } = res

  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data.map((model: string) => ({
    label: model,
    value: model,
  }))
}

export async function getUserGroups(): Promise<GroupOption[]> {
  const res = await api.get('/api/user/self/groups')
  const { data } = res

  if (!data.success || !data.data) {
    return []
  }

  const groupData = data.data as Record<string, { desc: string; ratio: number }>

  return Object.entries(groupData).map(([group, info]) => ({
    label: group,
    value: group,
    ratio: info.ratio,
    desc: info.desc,
  }))
}

export async function generateImage(
  payload: ImageGenerationRequest,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResponse> {
  const headers = await getFreshAuthHeaders()
  const response = await fetch('/pg/images/generations', {
    method: 'POST',
    headers: {
      ...headers,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      prompt: `${payload.prompt}\n\n${CHINESE_REVISED_PROMPT_INSTRUCTION}`,
    }),
    signal: options.signal,
  })

  const responseId =
    response.headers.get('x-request-id') ??
    response.headers.get('new-api-request-id') ??
    `${Date.now()}`
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''

  if (!response.ok) {
    throw new Error(await getImageResponseError(response))
  }

  if (contentType.includes('text/event-stream')) {
    return consumeImageGenerationSSE(response, responseId, options)
  }

  const imageResponse = (await response.json()) as ImageResponse
  return { ...imageResponse, responseId }
}

export async function generateRequestedImages(
  requests: ImageGenerationRequest[],
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResponse[]> {
  const responses = Array.from<ImageGenerationResponse | undefined>({
    length: requests.length,
  })
  let nextRequestIndex = 0

  const workers = Array.from(
    { length: Math.min(4, requests.length) },
    async () => {
      while (nextRequestIndex < requests.length) {
        const requestIndex = nextRequestIndex
        nextRequestIndex++

        let completedResponse: ImageGenerationResponse | undefined
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await generateImage(
              requests[requestIndex],
              options
            )
            if (response.error?.message) {
              throw new Error(response.error.message)
            }
            completedResponse = response
            break
          } catch (error) {
            if (
              options.signal?.aborted ||
              (error instanceof Error && error.name === 'AbortError')
            ) {
              throw error
            }
          }
        }

        if (!completedResponse) {
          options.onFailure?.(requestIndex)
          continue
        }
        responses[requestIndex] = completedResponse
        await options.onResponse?.(completedResponse, requestIndex)
      }
    }
  )

  await Promise.all(workers)
  return responses.filter(
    (response): response is ImageGenerationResponse => response !== undefined
  )
}

export async function editImage(
  {
    model,
    group,
    prompt,
    quality,
    n,
    image,
  }: ImageGenerationRequest & { image: File },
  signal?: AbortSignal
): Promise<ImageResponse> {
  const formData = new FormData()
  formData.append('model', model)
  formData.append(
    'prompt',
    `${prompt}\n\n${CHINESE_REVISED_PROMPT_INSTRUCTION}`
  )
  formData.append('n', String(n))
  formData.append('image', image)

  if (group) formData.append('group', group)
  if (quality && quality !== 'auto') formData.append('quality', quality)

  try {
    const res = await api.post('/pg/images/edits', formData, {
      skipErrorHandler: true,
      signal,
    })
    return res.data
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      error.response?.data?.error?.code === 'model_not_found'
    ) {
      throw new ImageModelUnavailableError()
    }
    throw error
  }
}

async function getImageResponseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ImageResponse
    if (body.error?.message) return body.error.message
  } catch {
    // The status text is the best available fallback for non-JSON errors.
  }
  return response.statusText || 'Image request failed'
}

function imageFromStreamEvent(event: ImageStreamEvent): ImageResult {
  return {
    ...(event.url !== undefined ? { url: event.url } : {}),
    ...(event.b64_json !== undefined ? { b64_json: event.b64_json } : {}),
    ...(event.revised_prompt !== undefined
      ? { revised_prompt: event.revised_prompt }
      : {}),
  }
}

function streamErrorMessage(event: ImageStreamEvent): string | null {
  if (typeof event.error === 'string' && event.error.trim()) {
    return event.error
  }
  if (typeof event.error === 'object' && event.error?.message) {
    return event.error.message
  }
  if (
    (event.type === 'error' || event.type === 'upstream_error') &&
    event.message
  ) {
    return event.message
  }
  return null
}

export async function consumeImageGenerationSSE(
  response: Response,
  responseId: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResponse> {
  if (!response.body) {
    throw new ImageStreamProtocolError('Image stream returned no response body')
  }

  const images: ImageResult[] = []
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let created: number | undefined
  let lineBuffer = ''
  let dataLines: string[] = []

  const dispatchEvent = () => {
    if (dataLines.length === 0) return
    const data = dataLines.join('\n')
    dataLines = []
    if (data === '[DONE]') return

    let event: ImageStreamEvent
    try {
      event = JSON.parse(data) as ImageStreamEvent
    } catch {
      throw new ImageStreamProtocolError(
        'Failed to parse image stream response'
      )
    }

    const errorMessage = streamErrorMessage(event)
    if (errorMessage) throw new Error(errorMessage)
    if (event.created_at && created === undefined) created = event.created_at

    const image = imageFromStreamEvent(event)
    if (event.type === 'image_generation.partial_image') {
      options.onPartial?.({
        image,
        imageIndex: event.output_index ?? event.image_index ?? 0,
        responseId,
      })
      return
    }
    if (
      event.type !== 'image_generation.completed' &&
      event.type !== 'image_edit.completed'
    ) {
      return
    }

    const imageIndex = images.length
    images.push(image)
    options.onCompleted?.({ image, imageIndex, responseId })
  }

  const processLines = (flush: boolean) => {
    let newlineIndex = lineBuffer.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = lineBuffer.slice(0, newlineIndex).replace(/\r$/, '')
      lineBuffer = lineBuffer.slice(newlineIndex + 1)
      if (line === '') {
        dispatchEvent()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart())
      }
      newlineIndex = lineBuffer.indexOf('\n')
    }

    if (flush) {
      const finalLine = lineBuffer.replace(/\r$/, '')
      if (finalLine.startsWith('data:')) {
        dataLines.push(finalLine.slice(5).trimStart())
      }
      lineBuffer = ''
      dispatchEvent()
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    lineBuffer += decoder.decode(value, { stream: true })
    processLines(false)
  }
  lineBuffer += decoder.decode()
  processLines(true)

  return { created, data: images, responseId }
}
