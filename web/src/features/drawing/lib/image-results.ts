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
import type {
  ImageAspectRatio,
  ImageGenerationRequest,
  ImageMode,
  ImageResult,
  QualityOption,
} from '../types'

export const MAX_DRAWING_IMAGE_COUNT = 128
export const DRAWING_ASPECT_RATIO_OPTIONS = [
  { value: '1:1', labelKey: 'Square' },
  { value: '2:3', labelKey: 'Portrait' },
  { value: '3:2', labelKey: 'Landscape' },
  { value: '3:4', labelKey: 'Portrait' },
  { value: '4:3', labelKey: 'Landscape' },
  { value: '9:16', labelKey: 'Portrait' },
  { value: '16:9', labelKey: 'Landscape' },
  { value: '4:5', labelKey: 'Portrait' },
  { value: '5:4', labelKey: 'Landscape' },
  { value: '1:2', labelKey: 'Portrait' },
  { value: '2:1', labelKey: 'Landscape' },
] as const satisfies ReadonlyArray<{
  value: ImageAspectRatio
  labelKey: 'Square' | 'Portrait' | 'Landscape'
}>

export type DrawingResult = ImageResult & { resultId: string }
export type CenterCrop = {
  sourceX: number
  sourceY: number
  sourceWidth: number
  sourceHeight: number
}

export function normalizeImageCount(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_DRAWING_IMAGE_COUNT, Math.max(1, Math.trunc(value)))
}

export function createImageRequests({
  mode,
  model,
  group,
  prompt,
  quality,
  aspectRatio,
  imageCount,
}: {
  mode: ImageMode
  model: string
  group: string
  prompt: string
  quality: QualityOption
  aspectRatio: ImageAspectRatio | 'auto'
  imageCount: number
}): ImageGenerationRequest[] {
  const requestCount = mode === 'generate' ? normalizeImageCount(imageCount) : 1
  const request: ImageGenerationRequest = {
    model,
    group,
    prompt:
      aspectRatio === 'auto' ? prompt : `${prompt}，图片比例为${aspectRatio}`,
    n: 1,
    ...(quality === 'auto' ? {} : { quality }),
  }
  return Array.from({ length: requestCount }, () => ({ ...request }))
}

export function getImageSrc(image: ImageResult): string {
  if (image.url) return image.url
  return image.b64_json ? `data:image/png;base64,${image.b64_json}` : ''
}

export function calculateCenterCrop(
  sourceWidth: number,
  sourceHeight: number,
  aspectRatio: ImageAspectRatio
): CenterCrop | null {
  const [ratioWidth, ratioHeight] = aspectRatio.split(':').map(Number)
  const scale = Math.floor(
    Math.min(sourceWidth / ratioWidth, sourceHeight / ratioHeight)
  )
  if (scale < 1) return null

  const cropWidth = ratioWidth * scale
  const cropHeight = ratioHeight * scale
  return {
    sourceX: (sourceWidth - cropWidth) / 2,
    sourceY: (sourceHeight - cropHeight) / 2,
    sourceWidth: cropWidth,
    sourceHeight: cropHeight,
  }
}

export async function centerCropImageResults(
  images: ImageResult[],
  aspectRatio: ImageAspectRatio | 'auto'
): Promise<ImageResult[]> {
  if (aspectRatio === 'auto') return images

  return Promise.all(
    images.map(async (image) => {
      const source = getImageSrc(image)
      if (!source) return image

      try {
        const sourceImage = await new Promise<HTMLImageElement>(
          (resolve, reject) => {
            const imageElement = new Image()
            imageElement.crossOrigin = 'anonymous'
            imageElement.addEventListener('load', () => resolve(imageElement), {
              once: true,
            })
            imageElement.addEventListener(
              'error',
              () =>
                reject(
                  new Error('Failed to load generated image for cropping')
                ),
              { once: true }
            )
            imageElement.src = source
          }
        )
        const crop = calculateCenterCrop(
          sourceImage.naturalWidth,
          sourceImage.naturalHeight,
          aspectRatio
        )
        if (!crop) return image
        if (
          crop.sourceWidth === sourceImage.naturalWidth &&
          crop.sourceHeight === sourceImage.naturalHeight
        ) {
          return image
        }

        const canvas = document.createElement('canvas')
        canvas.width = crop.sourceWidth
        canvas.height = crop.sourceHeight
        const context = canvas.getContext('2d')
        if (!context) return image

        context.drawImage(
          sourceImage,
          crop.sourceX,
          crop.sourceY,
          crop.sourceWidth,
          crop.sourceHeight,
          0,
          0,
          crop.sourceWidth,
          crop.sourceHeight
        )
        const dataUrl = canvas.toDataURL('image/png')
        const separatorIndex = dataUrl.indexOf(',')
        if (separatorIndex < 0) return image

        const croppedImage = {
          ...image,
          b64_json: dataUrl.slice(separatorIndex + 1),
        }
        delete croppedImage.url
        return croppedImage
      } catch {
        return image
      }
    })
  )
}

export function createDrawingResults(
  images: ImageResult[],
  responseId: string | number
): DrawingResult[] {
  return images.map((image, imageIndex) => ({
    ...image,
    resultId: `${responseId}-${imageIndex}`,
  }))
}

export function createDrawingResultsFromResponses(
  responses: Array<{
    data?: ImageResult[]
    responseId: string | number
  }>,
  maxResults: number
): DrawingResult[] {
  const results: DrawingResult[] = []
  for (const response of responses) {
    if (results.length >= maxResults) break
    const image = response.data?.[0]
    if (!image) continue
    results.push(...createDrawingResults([image], response.responseId))
  }
  return results
}
