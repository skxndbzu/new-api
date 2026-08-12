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
import { Upload, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type ReferenceImageUploadProps = {
  files: File[]
  maxFiles: number
  disabled: boolean
  onFilesChange: (files: File[]) => void
}

function ReferenceImagePreview({
  file,
  index,
  disabled,
  onRemove,
}: {
  file: File
  index: number
  disabled: boolean
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  return (
    <div className='bg-muted relative aspect-square overflow-hidden rounded-md border'>
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={t('Reference image {{index}}', { index: index + 1 })}
          className='size-full object-contain'
        />
      ) : null}
      <Button
        type='button'
        variant='secondary'
        size='icon-xs'
        className='absolute top-1 right-1 shadow-sm'
        disabled={disabled}
        aria-label={t('Remove reference image {{index}}', {
          index: index + 1,
        })}
        title={t('Remove reference image {{index}}', { index: index + 1 })}
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  )
}

export function ReferenceImageUpload(props: ReferenceImageUploadProps) {
  const { t } = useTranslation()
  const atLimit = props.files.length >= props.maxFiles

  const addFiles = (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return
    const availableSlots = props.maxFiles - props.files.length
    if (selectedFiles.length > availableSlots) {
      toast.error(
        t('You can upload up to {{count}} reference images.', {
          count: props.maxFiles,
        })
      )
    }
    props.onFilesChange([
      ...props.files,
      ...selectedFiles.slice(0, Math.max(0, availableSlots)),
    ])
  }

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between gap-3'>
        <Label htmlFor='drawing-images'>{t('Reference images')}</Label>
        <span className='text-muted-foreground text-xs tabular-nums'>
          {props.files.length}/{props.maxFiles}
        </span>
      </div>
      <label
        htmlFor='drawing-images'
        className={cn(
          'border-input bg-background hover:bg-accent flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-center transition-colors',
          (props.disabled || atLimit) && 'pointer-events-none opacity-60'
        )}
      >
        <Upload className='text-muted-foreground size-5' />
        <span className='text-sm font-medium'>
          {props.files.length > 0
            ? t('Add reference images')
            : t('Upload reference images')}
        </span>
      </label>
      <Input
        id='drawing-images'
        type='file'
        accept='image/*'
        multiple
        className='sr-only'
        disabled={props.disabled || atLimit}
        onChange={(event) => {
          addFiles([...(event.currentTarget.files ?? [])])
          event.currentTarget.value = ''
        }}
      />
      {props.files.length > 0 ? (
        <div className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
          {props.files.map((file, index) => (
            <ReferenceImagePreview
              key={`${file.name}-${file.size}-${file.type}-${file.lastModified}`}
              file={file}
              index={index}
              disabled={props.disabled}
              onRemove={() =>
                props.onFilesChange(
                  props.files.filter((_, fileIndex) => fileIndex !== index)
                )
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
