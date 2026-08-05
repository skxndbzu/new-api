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
import type { TFunction } from 'i18next'
import { z } from 'zod'

export function createTokenPeakConfigSchema(t: TFunction) {
  return z
    .object({
      enabled: z.boolean(),
      reward_count: z
        .number()
        .int()
        .min(1, t('Reward positions must be between 1 and 100'))
        .max(100, t('Reward positions must be between 1 and 100')),
      rewards: z.array(
        z.object({
          position: z.number().int().positive(),
          reward_quota: z.number().min(0, t('Reward quota cannot be negative')),
        })
      ),
    })
    .refine((value) => value.rewards.length === value.reward_count, {
      path: ['rewards'],
      message: t('Reward rules must match the reward count'),
    })
}

export type TokenPeakConfigFormValues = z.infer<
  ReturnType<typeof createTokenPeakConfigSchema>
>
