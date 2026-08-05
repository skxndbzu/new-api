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

import {
  getCountdownParts,
  getNextShanghaiSettlement,
  parseSettlementAt,
} from '../time'

describe('Token Peak settlement time', () => {
  test('targets the same-day 00:00 settlement before the Beijing cutoff', () => {
    const now = Date.UTC(2026, 7, 4, 15, 55)

    assert.equal(getNextShanghaiSettlement(now), Date.UTC(2026, 7, 4, 16, 0))
  })

  test('targets the next-day 00:00 settlement after the Beijing cutoff', () => {
    const now = Date.UTC(2026, 7, 4, 16, 1)

    assert.equal(getNextShanghaiSettlement(now), Date.UTC(2026, 7, 5, 16, 0))
  })

  test('maps the backend reward time to the midnight ranking settlement', () => {
    assert.equal(
      parseSettlementAt(1_800_000_000, 1_700_000_000_000),
      1_799_999_400_000
    )
  })

  test('formats a positive countdown without crossing unit boundaries', () => {
    assert.deepEqual(getCountdownParts(10_000_000, 2_699_000), {
      hours: 2,
      minutes: 1,
      seconds: 41,
    })
  })
})
