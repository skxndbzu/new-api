import { useQuery } from '@tanstack/react-query'
import {
  Download,
  ExternalLink,
  ImageIcon,
  Loader2,
  PencilLine,
  Sparkles,
  Upload,
} from 'lucide-react'
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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CopyButton } from '@/components/copy-button'
import { GroupSelector, ModelSelector } from '@/components/model-group-selector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { editImage, generateImage, getUserGroups, getUserModels } from './api'
import type {
  ImageGenerationRequest,
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

type DrawingResult = ImageResult & { resultId: string }

const getImageSrc = (image: ImageResult) =>
  image.url ?? (image.b64_json ? `data:image/png;base64,${image.b64_json}` : '')

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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [results, setResults] = useState<DrawingResult[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const submitImageRequest = async () => {
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

    const payload: ImageGenerationRequest = {
      model,
      group,
      prompt: trimmedPrompt,
      n: 1,
      ...(quality === 'auto' ? {} : { quality }),
    }

    setIsSubmitting(true)
    try {
      const response =
        mode === 'edit' && imageFile
          ? await editImage({ ...payload, image: imageFile })
          : await generateImage(payload)

      if (response.error?.message) {
        throw new Error(response.error.message)
      }

      const nextResults = response.data ?? []
      const responseId = response.created ?? Date.now()
      setResults(
        nextResults.map((image, imageIndex) => ({
          ...image,
          resultId: `${responseId}-${imageIndex}`,
        }))
      )
      if (nextResults.length === 0) {
        toast.warning(t('The image model returned no images.'))
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Image request failed')
      )
    } finally {
      setIsSubmitting(false)
    }
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
                  <SelectItem value='auto'>{t('Auto')}</SelectItem>
                  <SelectItem value='standard'>{t('Standard')}</SelectItem>
                  <SelectItem value='hd'>{t('HD')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type='button'
              className='h-10 gap-2'
              onClick={submitImageRequest}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <ImageIcon className='size-4' />
              )}
              {mode === 'edit' ? t('Edit image') : t('Generate image')}
            </Button>
          </section>

          <section className='bg-card min-h-[520px] rounded-lg border p-4 shadow-sm'>
            {results.length === 0 ? (
              <div className='flex h-full min-h-[420px] flex-col items-center justify-center gap-3 text-center'>
                <div className='bg-muted flex size-14 items-center justify-center rounded-full'>
                  <ImageIcon className='text-muted-foreground size-7' />
                </div>
                <div className='space-y-1'>
                  <h2 className='text-lg font-medium'>{t('No images yet')}</h2>
                  <p className='text-muted-foreground max-w-md text-sm'>
                    {t('Generated images will appear here.')}
                  </p>
                </div>
              </div>
            ) : (
              <div className='grid gap-4 md:grid-cols-2'>
                {results.map((image, index) => {
                  const src = getImageSrc(image)
                  return (
                    <article
                      key={image.resultId}
                      className='bg-background overflow-hidden rounded-lg border'
                    >
                      {src ? (
                        <img
                          src={src}
                          alt={t('Generated image')}
                          className='bg-muted aspect-square w-full object-contain'
                        />
                      ) : (
                        <div className='bg-muted flex aspect-square w-full items-center justify-center'>
                          <ImageIcon className='text-muted-foreground size-8' />
                        </div>
                      )}
                      <div className='space-y-3 p-3'>
                        {image.revised_prompt && (
                          <div className='bg-muted/50 flex flex-col gap-2 rounded-md border p-3'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                              <p className='text-sm font-medium'>
                                {t('Revised prompt')}
                              </p>
                              <CopyButton
                                value={image.revised_prompt}
                                variant='outline'
                                size='sm'
                                tooltip={t('Copy prompt')}
                                successTooltip={t('Copied!')}
                                aria-label={t('Copy prompt')}
                              >
                                {t('Copy prompt')}
                              </CopyButton>
                            </div>
                            <p className='text-muted-foreground text-xs leading-relaxed break-words whitespace-pre-wrap'>
                              {image.revised_prompt}
                            </p>
                          </div>
                        )}
                        <div className='flex items-center justify-end gap-2'>
                          {image.url && (
                            <Button
                              variant='outline'
                              size='sm'
                              render={
                                <a
                                  href={image.url}
                                  target='_blank'
                                  rel='noreferrer'
                                />
                              }
                            >
                              <ExternalLink className='size-4' />
                              {t('Open image')}
                            </Button>
                          )}
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => downloadImage(image, index)}
                            disabled={!src}
                          >
                            <Download className='size-4' />
                            {t('Download image')}
                          </Button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
