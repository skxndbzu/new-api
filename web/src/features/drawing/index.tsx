import { useQuery } from '@tanstack/react-query'
import { ImageIcon, PencilLine, Sparkles, Square, Upload } from 'lucide-react'
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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { GroupSelector, ModelSelector } from '@/components/model-group-selector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import {
  editImage,
  generateRequestedImages,
  getUserGroups,
  getUserModels,
  ImageModelUnavailableError,
  ImageStreamProtocolError,
} from './api'
import { ImageResults } from './components/image-results'
import {
  centerCropImageResults,
  createDrawingResultsFromResponses,
  createImageRequests,
  DRAWING_ASPECT_RATIO_OPTIONS,
  getImageSrc,
  MAX_DRAWING_IMAGE_COUNT,
  normalizeImageCount,
  type DrawingResult,
} from './lib/image-results'
import type {
  ImageAspectRatio,
  ImageGenerationBatchProgress,
  ImageMode,
  ImageResult,
  ModelOption,
  QualityOption,
} from './types'

const IMAGE_MODEL_KEYWORDS = [
  'gpt-image-2',
  'gpt-image-1.5',
  'gpt-image-1',
  'dall-e',
  'imagen',
  'flux',
  'image',
]

function pickDefaultImageModel(models: ModelOption[]) {
  for (const keyword of IMAGE_MODEL_KEYWORDS) {
    const model = models.find((item) =>
      item.value.toLowerCase().includes(keyword)
    )
    if (model) return model.value
  }

  return models[0]?.value ?? ''
}

export function Drawing() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<ImageMode>('generate')
  const [model, setModel] = useState('')
  const [group, setGroup] = useState('')
  const [prompt, setPrompt] = useState('')
  const [quality, setQuality] = useState<QualityOption>('auto')
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio | 'auto'>(
    'auto'
  )
  const [imageCountInput, setImageCountInput] = useState('1')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [results, setResults] = useState<DrawingResult[]>([])
  const [generationProgress, setGenerationProgress] =
    useState<ImageGenerationBatchProgress | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const { data: models = [] } = useQuery({
    queryKey: ['drawing-models'],
    queryFn: async () => {
      try {
        return await getUserModels()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('Failed to load image models')
        )
        return []
      }
    },
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['drawing-groups'],
    queryFn: async () => {
      try {
        return await getUserGroups()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('Failed to load image groups')
        )
        return []
      }
    },
  })

  const imageModels = useMemo(() => {
    const filtered = models.filter((item) => {
      const value = item.value.toLowerCase()
      return IMAGE_MODEL_KEYWORDS.some((keyword) => value.includes(keyword))
    })

    return filtered.length > 0 ? filtered : models
  }, [models])

  const aspectRatioItems = useMemo(
    () => [
      { label: t('Auto'), value: 'auto' as const },
      ...DRAWING_ASPECT_RATIO_OPTIONS.map((option) => ({
        label: `${t(option.labelKey)} (${option.value})`,
        value: option.value,
      })),
    ],
    [t]
  )

  useEffect(() => {
    if (
      imageModels.length === 0 ||
      imageModels.some((item) => item.value === model)
    ) {
      return
    }

    setModel(pickDefaultImageModel(imageModels))
  }, [imageModels, model])

  useEffect(() => {
    if (groups.length === 0 || groups.some((item) => item.value === group)) {
      return
    }

    setGroup(
      groups.find((item) => item.value === 'default')?.value ?? groups[0].value
    )
  }, [group, groups])

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl('')
      return
    }

    const objectUrl = URL.createObjectURL(imageFile)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [imageFile])

  useEffect(
    () => () => {
      abortControllerRef.current?.abort()
    },
    []
  )

  const submitImageRequest = async () => {
    if (isSubmitting || abortControllerRef.current) return

    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      toast.error(t('Please enter a prompt.'))
      return
    }
    if (!model) {
      toast.error(t('Please select an image model.'))
      return
    }
    if (mode === 'edit' && !imageFile) {
      toast.error(t('Please upload a reference image for edit mode.'))
      return
    }

    const requests = createImageRequests({
      mode,
      model,
      group,
      prompt: trimmedPrompt,
      quality,
      aspectRatio,
      imageCount: Number(imageCountInput),
    })

    const abortController = new AbortController()
    const startedAt = performance.now()
    let succeededCount = 0
    let failedCount = 0
    abortControllerRef.current = abortController
    setResults([])
    setGenerationProgress({
      total: requests.length,
      succeeded: 0,
      failed: 0,
      elapsedMs: 0,
    })
    const progressTimer = window.setInterval(() => {
      setGenerationProgress((currentProgress) =>
        currentProgress
          ? {
              ...currentProgress,
              elapsedMs: performance.now() - startedAt,
            }
          : null
      )
    }, 250)
    setIsSubmitting(true)
    try {
      let responses
      if (mode === 'edit' && imageFile) {
        const response = await editImage(
          { ...requests[0], image: imageFile },
          abortController.signal
        )
        response.data = await centerCropImageResults(
          response.data ?? [],
          aspectRatio
        )
        responses = [response]
      } else {
        responses = await generateRequestedImages(requests, {
          signal: abortController.signal,
          onResponse: async (response, requestIndex) => {
            response.data = await centerCropImageResults(
              response.data ?? [],
              aspectRatio
            )
            const completedResults = createDrawingResultsFromResponses(
              [
                {
                  data: response.data,
                  responseId: `${response.responseId}-${requestIndex}`,
                },
              ],
              1
            ).map((result) => ({ ...result, prompt: trimmedPrompt }))
            if (completedResults.length === 0) {
              failedCount++
              setGenerationProgress({
                total: requests.length,
                succeeded: succeededCount,
                failed: failedCount,
                elapsedMs: performance.now() - startedAt,
              })
              return
            }

            succeededCount++
            setGenerationProgress({
              total: requests.length,
              succeeded: succeededCount,
              failed: failedCount,
              elapsedMs: performance.now() - startedAt,
            })

            setResults((currentResults) => {
              const remainingCount = requests.length - currentResults.length
              if (remainingCount <= 0) return currentResults
              return [
                ...currentResults,
                ...completedResults.slice(0, remainingCount),
              ]
            })
          },
          onFailure: () => {
            failedCount++
            setGenerationProgress({
              total: requests.length,
              succeeded: succeededCount,
              failed: failedCount,
              elapsedMs: performance.now() - startedAt,
            })
          },
        })
      }

      const responseError = responses.find(
        (response) => response.error?.message
      )
      if (responseError?.error?.message) {
        throw new Error(responseError.error.message)
      }

      const nextResults = createDrawingResultsFromResponses(
        responses.map((response, requestIndex) => ({
          data: response.data,
          responseId:
            'responseId' in response && typeof response.responseId === 'string'
              ? response.responseId
              : `${response.created ?? Date.now()}-${requestIndex}`,
        })),
        requests.length
      ).map((result) => ({ ...result, prompt: trimmedPrompt }))
      if (mode === 'edit') {
        setResults(nextResults)
        succeededCount = nextResults.length
        failedCount = requests.length - succeededCount
        setGenerationProgress({
          total: requests.length,
          succeeded: succeededCount,
          failed: failedCount,
          elapsedMs: performance.now() - startedAt,
        })
      }
      if (nextResults.length === 0) {
        toast.warning(t('This group does not have the selected image model.'))
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setGenerationProgress(null)
        return
      }
      abortController.abort()
      setGenerationProgress({
        total: requests.length,
        succeeded: succeededCount,
        failed: requests.length - succeededCount,
        elapsedMs: performance.now() - startedAt,
      })
      let message = t('Image request failed')
      if (error instanceof ImageModelUnavailableError) {
        message = t('This group does not have the selected image model.')
      } else if (
        error instanceof Error &&
        !(error instanceof ImageStreamProtocolError) &&
        error.message !== 'Image request failed'
      ) {
        message = error.message
      }
      toast.error(message)
    } finally {
      window.clearInterval(progressTimer)
      setGenerationProgress((currentProgress) =>
        currentProgress
          ? {
              ...currentProgress,
              elapsedMs: performance.now() - startedAt,
            }
          : null
      )
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null
      }
      setIsSubmitting(false)
    }
  }

  const cancelImageRequest = () => {
    abortControllerRef.current?.abort()
  }

  const downloadImage = (image: ImageResult, index: number) => {
    const src = getImageSrc(image)
    if (!src) return

    const link = document.createElement('a')
    link.href = src
    link.download = `drawing-${Date.now()}-${index + 1}.png`
    link.rel = 'noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <div className='bg-background min-h-full'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-6'>
        <div className='flex flex-col gap-3 border-b pb-4 md:flex-row md:items-center md:justify-between'>
          <div className='space-y-1'>
            <h1 className='flex items-center gap-2 text-2xl font-semibold tracking-normal'>
              <ImageIcon className='text-primary size-6' />
              {t('Image Studio')}
            </h1>
            <p className='text-muted-foreground text-sm'>
              {t('Use image-generation models to create or edit images.')}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <GroupSelector
              selectedGroup={group}
              groups={groups}
              onGroupChange={setGroup}
              disabled={isSubmitting}
            />
            <ModelSelector
              selectedModel={model}
              models={imageModels}
              onModelChange={setModel}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className='grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]'>
          <section className='bg-card flex flex-col gap-5 rounded-lg border p-4 shadow-sm'>
            <div className='bg-muted grid grid-cols-2 rounded-lg p-1'>
              {(['generate', 'edit'] as ImageMode[]).map((item) => (
                <Button
                  key={item}
                  type='button'
                  variant={mode === item ? 'default' : 'ghost'}
                  size='sm'
                  className='gap-2'
                  onClick={() => setMode(item)}
                  disabled={isSubmitting}
                >
                  {item === 'generate' ? (
                    <Sparkles className='size-4' />
                  ) : (
                    <PencilLine className='size-4' />
                  )}
                  {item === 'generate' ? t('Generate') : t('Edit')}
                </Button>
              ))}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='drawing-prompt'>{t('Prompt')}</Label>
              <Textarea
                id='drawing-prompt'
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={t(
                  'Describe the image you want to create or edit.'
                )}
                className='min-h-36 resize-none'
                disabled={isSubmitting}
              />
            </div>

            {mode === 'edit' && (
              <div className='space-y-2'>
                <Label htmlFor='drawing-image'>{t('Reference image')}</Label>
                <label
                  htmlFor='drawing-image'
                  className={cn(
                    'border-input bg-background hover:bg-accent flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center transition-colors',
                    isSubmitting && 'pointer-events-none opacity-60'
                  )}
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={t('Reference preview')}
                      className='max-h-52 rounded-md object-contain'
                    />
                  ) : (
                    <>
                      <Upload className='text-muted-foreground size-6' />
                      <span className='text-sm font-medium'>
                        {t('Upload image')}
                      </span>
                      <span className='text-muted-foreground text-xs'>
                        {t(
                          'The model will edit this image based on your prompt.'
                        )}
                      </span>
                    </>
                  )}
                </label>
                <Input
                  id='drawing-image'
                  type='file'
                  accept='image/*'
                  className='sr-only'
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setImageFile(event.target.files?.[0] ?? null)
                  }
                />
              </div>
            )}

            <div className='space-y-2'>
              <Label>{t('Quality')}</Label>
              <Select
                value={quality}
                onValueChange={(value) => setQuality(value as QualityOption)}
                disabled={isSubmitting}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value='auto'>{t('Auto')}</SelectItem>
                    <SelectItem value='standard'>{t('Standard')}</SelectItem>
                    <SelectItem value='hd'>{t('HD')}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='drawing-aspect-ratio'>{t('Aspect ratio')}</Label>
              <Select
                items={aspectRatioItems}
                value={aspectRatio}
                onValueChange={(value) =>
                  setAspectRatio(value as ImageAspectRatio | 'auto')
                }
                disabled={isSubmitting}
              >
                <SelectTrigger id='drawing-aspect-ratio' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {aspectRatioItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='drawing-image-count'>{t('Image count')}</Label>
              <Input
                id='drawing-image-count'
                type='number'
                inputMode='numeric'
                min={1}
                max={MAX_DRAWING_IMAGE_COUNT}
                step={1}
                value={mode === 'generate' ? imageCountInput : '1'}
                disabled={isSubmitting || mode === 'edit'}
                aria-describedby='drawing-image-count-description'
                onChange={(event) =>
                  setImageCountInput(event.currentTarget.value)
                }
                onBlur={() =>
                  setImageCountInput(
                    String(normalizeImageCount(Number(imageCountInput)))
                  )
                }
              />
              <p
                id='drawing-image-count-description'
                className='text-muted-foreground text-xs'
              >
                {mode === 'edit'
                  ? t('Edit mode supports one image per request.')
                  : t('Choose between 1 and 128 images.')}
              </p>
            </div>

            {isSubmitting ? (
              <Button
                type='button'
                variant='outline'
                className='h-10 gap-2'
                onClick={cancelImageRequest}
              >
                <Square className='size-4' />
                {t('Cancel')}
              </Button>
            ) : (
              <Button
                type='button'
                className='h-10 gap-2'
                onClick={submitImageRequest}
              >
                <ImageIcon className='size-4' />
                {mode === 'edit' ? t('Edit image') : t('Generate image')}
              </Button>
            )}
          </section>

          <section className='bg-card min-h-[520px] rounded-lg border p-4 shadow-sm'>
            <ImageResults
              results={results}
              isSubmitting={isSubmitting}
              progress={generationProgress}
              onDownload={downloadImage}
            />
          </section>
        </div>
      </div>
    </div>
  )
}
