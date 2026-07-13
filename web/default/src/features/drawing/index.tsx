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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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
import { GroupSelector, ModelSelector } from '@/components/model-group-selector'
import { editImage, generateImage, getUserGroups, getUserModels } from './api'
import type {
  ImageGenerationRequest,
  ImageMode,
  ImageResult,
  ModelOption,
  QualityOption,
  RatioOption,
  ResolutionOption,
} from './types'

const RATIO_OPTIONS: Array<{ value: RatioOption; label: string }> = [
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
]

const RESOLUTION_OPTIONS: ResolutionOption[] = ['1k', '2k', '4k']

const SIZE_MAP: Record<RatioOption, Record<ResolutionOption, string>> = {
  '1:1': { '1k': '1024x1024', '2k': '2048x2048', '4k': '4096x4096' },
  '16:9': { '1k': '1792x1024', '2k': '3584x2048', '4k': '7168x4096' },
  '9:16': { '1k': '1024x1792', '2k': '2048x3584', '4k': '4096x7168' },
  '4:3': { '1k': '1365x1024', '2k': '2730x2048', '4k': '5460x4096' },
  '3:4': { '1k': '1024x1365', '2k': '2048x2730', '4k': '4096x5460' },
}

const IMAGE_MODEL_KEYWORDS = [
  'gpt-image-2',
  'gpt-image-1.5',
  'gpt-image-1',
  'dall-e',
  'imagen',
  'flux',
  'image',
]

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
  const [ratio, setRatio] = useState<RatioOption>('1:1')
  const [resolution, setResolution] = useState<ResolutionOption>('1k')
  const [quality, setQuality] = useState<QualityOption>('auto')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [results, setResults] = useState<ImageResult[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: models = [] } = useQuery({
    queryKey: ['drawing-models'],
    queryFn: async () => {
      try {
        return await getUserModels()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t('Failed to load image models')
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
          error instanceof Error ? error.message : t('Failed to load image groups')
        )
        return []
      }
    },
  })

  const size = SIZE_MAP[ratio][resolution]

  const imageModels = useMemo(() => {
    const filtered = models.filter((item) => {
      const value = item.value.toLowerCase()
      return IMAGE_MODEL_KEYWORDS.some((keyword) => value.includes(keyword))
    })

    return filtered.length > 0 ? filtered : models
  }, [models])

  useEffect(() => {
    if (imageModels.length === 0 || imageModels.some((item) => item.value === model)) {
      return
    }

    setModel(pickDefaultImageModel(imageModels))
  }, [imageModels, model])

  useEffect(() => {
    if (groups.length === 0 || groups.some((item) => item.value === group)) {
      return
    }

    setGroup(groups.find((item) => item.value === 'default')?.value ?? groups[0].value)
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
      size,
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
      setResults(nextResults)
      if (nextResults.length === 0) {
        toast.warning(t('The image model returned no images.'))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Image request failed'))
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
            <div className='grid grid-cols-2 rounded-lg bg-muted p-1'>
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
                placeholder={t('Describe the image you want to create or edit.')}
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
                      <span className='text-sm font-medium'>{t('Upload image')}</span>
                      <span className='text-muted-foreground text-xs'>
                        {t('The model will edit this image based on your prompt.')}
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
                  onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                />
              </div>
            )}

            <div className='space-y-2'>
              <Label>{t('Aspect ratio')}</Label>
              <div className='grid grid-cols-5 gap-2'>
                {RATIO_OPTIONS.map((item) => (
                  <Button
                    key={item.value}
                    type='button'
                    variant={ratio === item.value ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => setRatio(item.value)}
                    disabled={isSubmitting}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label>{t('Resolution')}</Label>
                <div className='grid grid-cols-3 gap-2'>
                  {RESOLUTION_OPTIONS.map((item) => (
                    <Button
                      key={item}
                      type='button'
                      variant={resolution === item ? 'default' : 'outline'}
                      size='sm'
                      onClick={() => setResolution(item)}
                      disabled={isSubmitting}
                    >
                      {item.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>

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
            </div>

            <div className='text-muted-foreground rounded-md bg-muted px-3 py-2 text-xs'>
              {t('Request size')}: {size}
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
                      key={`${src}-${index}`}
                      className='overflow-hidden rounded-lg border bg-background'
                    >
                      {src ? (
                        <img
                          src={src}
                          alt={t('Generated image')}
                          className='aspect-square w-full bg-muted object-contain'
                        />
                      ) : (
                        <div className='flex aspect-square w-full items-center justify-center bg-muted'>
                          <ImageIcon className='text-muted-foreground size-8' />
                        </div>
                      )}
                      <div className='space-y-3 p-3'>
                        {image.revised_prompt && (
                          <p className='text-muted-foreground line-clamp-3 text-xs'>
                            <span className='text-foreground font-medium'>
                              {t('Revised prompt')}:{' '}
                            </span>
                            {image.revised_prompt}
                          </p>
                        )}
                        <div className='flex items-center justify-end gap-2'>
                          {image.url && (
                            <Button
                              variant='outline'
                              size='sm'
                              render={
                                <a href={image.url} target='_blank' rel='noreferrer' />
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
