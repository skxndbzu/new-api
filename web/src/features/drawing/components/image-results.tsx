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
import { Download, ExternalLink, ImageIcon, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress'

import { getImageSrc, type DrawingResult } from '../lib/image-results'
import type { ImageGenerationBatchProgress, ImageResult } from '../types'

type ImageResultsProps = {
  results: DrawingResult[]
  isSubmitting: boolean
  progress?: ImageGenerationBatchProgress | null
  onDownload: (image: ImageResult, index: number) => void
}

function GenerationProgress({
  progress,
}: {
  progress: ImageGenerationBatchProgress
}) {
  const { t } = useTranslation()
  const completed = progress.succeeded + progress.failed
  const percentage =
    progress.total > 0 ? Math.min(100, (completed / progress.total) * 100) : 0
  const elapsedTime =
    progress.elapsedMs < 1000
      ? t('{{value}}ms', { value: Math.round(progress.elapsedMs) })
      : t('{{value}}s', { value: (progress.elapsedMs / 1000).toFixed(1) })

  return (
    <div className='space-y-3 border-b pb-4' aria-live='polite'>
      <Progress value={percentage}>
        <ProgressLabel>{t('Progress')}</ProgressLabel>
        <ProgressValue />
      </Progress>
      <dl className='grid grid-cols-2 gap-3 text-sm sm:grid-cols-4'>
        <div>
          <dt className='text-muted-foreground'>{t('Total')}</dt>
          <dd className='font-medium tabular-nums'>{progress.total}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('Succeeded')}</dt>
          <dd className='font-medium text-emerald-600 tabular-nums dark:text-emerald-400'>
            {progress.succeeded}
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('Failed')}</dt>
          <dd className='text-destructive font-medium tabular-nums'>
            {progress.failed}
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('Duration')}</dt>
          <dd className='font-medium tabular-nums'>{elapsedTime}</dd>
        </div>
      </dl>
    </div>
  )
}

function ImagePreview({ image, alt }: { image: ImageResult; alt: string }) {
  const src = getImageSrc(image)
  if (!src) {
    return (
      <div className='bg-muted flex aspect-square w-full items-center justify-center'>
        <ImageIcon className='text-muted-foreground size-8' />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading='lazy'
      decoding='async'
      className='bg-muted aspect-square w-full object-contain'
    />
  )
}

function CompletedImageCard({
  image,
  index,
  onDownload,
}: {
  image: DrawingResult
  index: number
  onDownload: ImageResultsProps['onDownload']
}) {
  const { t } = useTranslation()
  const src = getImageSrc(image)
  const revisedPrompt = image.revised_prompt?.trim()
  const displayPrompt = revisedPrompt || image.prompt?.trim()

  return (
    <article
      data-drawing-image={index + 1}
      className='bg-background overflow-hidden rounded-lg border'
    >
      <ImagePreview image={image} alt={t('Generated image')} />
      <div className='space-y-3 p-3'>
        {displayPrompt && (
          <div className='bg-muted/50 space-y-2 p-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <p className='text-sm font-medium'>
                {revisedPrompt ? t('Revised prompt') : t('Prompt')}
              </p>
              <CopyButton
                value={displayPrompt}
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
              {displayPrompt}
            </p>
          </div>
        )}
        <div
          data-image-actions
          className='flex flex-wrap items-center justify-end gap-2'
        >
          {image.url ? (
            <Button
              variant='outline'
              size='sm'
              className='h-auto min-h-7 max-w-full whitespace-normal'
              nativeButton={false}
              render={<a href={image.url} target='_blank' rel='noreferrer' />}
            >
              <ExternalLink className='size-4' />
              {t('Open image')}
            </Button>
          ) : null}
          <Button
            variant='outline'
            size='sm'
            className='h-auto min-h-7 max-w-full whitespace-normal'
            onClick={() => onDownload(image, index)}
            disabled={!src}
          >
            <Download className='size-4' />
            {t('Download image')}
          </Button>
        </div>
      </div>
    </article>
  )
}

export function ImageResults({
  results,
  isSubmitting,
  progress,
  onDownload,
}: ImageResultsProps) {
  const { t } = useTranslation()

  const resultContent =
    results.length === 0 ? (
      <div className='flex h-full min-h-[420px] flex-col items-center justify-center gap-3 text-center'>
        <div className='bg-muted flex size-14 items-center justify-center rounded-full'>
          {isSubmitting ? (
            <Loader2 className='text-muted-foreground size-7 animate-spin' />
          ) : (
            <ImageIcon className='text-muted-foreground size-7' />
          )}
        </div>
        <div className='space-y-1' aria-live='polite'>
          <h2 className='text-lg font-medium'>
            {isSubmitting ? t('Generating...') : t('No images yet')}
          </h2>
          {!isSubmitting && (
            <p className='text-muted-foreground max-w-md text-sm'>
              {t('Generated images will appear here.')}
            </p>
          )}
        </div>
      </div>
    ) : (
      <div className='grid gap-4 md:grid-cols-2'>
        {results.map((image, index) => (
          <CompletedImageCard
            key={image.resultId}
            image={image}
            index={index}
            onDownload={onDownload}
          />
        ))}
      </div>
    )

  return (
    <div className='space-y-4'>
      {progress ? <GenerationProgress progress={progress} /> : null}
      {resultContent}
    </div>
  )
}
