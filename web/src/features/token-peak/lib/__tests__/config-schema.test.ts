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

import type { TFunction } from 'i18next'

import { createTokenPeakConfigSchema } from '../config-schema'

const translate = ((key: string) => key) as TFunction
const schema = createTokenPeakConfigSchema(translate)

describe('Token Peak configuration', () => {
  test('accepts one backend reward rule for each configured position', () => {
    const result = schema.safeParse({
      enabled: true,
      reward_count: 2,
      rewards: [
        { position: 1, reward_quota: 10_000 },
        { position: 2, reward_quota: 5_000 },
      ],
    })

    assert.equal(result.success, true)
  })

  test('rejects a reward list that does not match the configured count', () => {
    const result = schema.safeParse({
      enabled: true,
      reward_count: 2,
      rewards: [{ position: 1, reward_quota: 10_000 }],
    })

    assert.equal(result.success, false)
  })

  test('rejects a negative reward quota', () => {
    const result = schema.safeParse({
      enabled: true,
      reward_count: 1,
      rewards: [{ position: 1, reward_quota: -1 }],
    })

    assert.equal(result.success, false)
  })
})
