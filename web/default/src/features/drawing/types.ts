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
export type ImageMode = 'generate' | 'edit'
export type QualityOption = 'auto' | 'standard' | 'hd'

export interface ModelOption {
  label: string
  value: string
}

export interface GroupOption {
  label: string
  value: string
  ratio: number
  desc?: string
}

export interface ImageResult {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

export interface ImageGenerationRequest {
  model: string
  group?: string
  prompt: string
  quality?: QualityOption
  n: number
}

export interface ImageResponse {
  created?: number
  data?: ImageResult[]
  error?: {
    message?: string
  }
}
