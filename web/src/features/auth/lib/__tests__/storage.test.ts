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
*/
import assert from 'node:assert/strict'
import { describe, test } from 'vitest'

import {
  clearPendingLoginWelcome,
  hasPendingLoginWelcome,
  markLoginWelcomePending,
} from '../storage'

describe('post-login welcome dialog storage', () => {
  test('makes the dialog pending until it is dismissed', () => {
    const sessionStorage = new Map<string, string>()
    const previousWindow = globalThis.window

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        sessionStorage: {
          getItem(key: string) {
            return sessionStorage.get(key) ?? null
          },
          setItem(key: string, value: string) {
            sessionStorage.set(key, value)
          },
          removeItem(key: string) {
            sessionStorage.delete(key)
          },
        },
      },
    })

    try {
      assert.equal(hasPendingLoginWelcome(), false)

      markLoginWelcomePending()
      assert.equal(hasPendingLoginWelcome(), true)

      clearPendingLoginWelcome()
      assert.equal(hasPendingLoginWelcome(), false)
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: previousWindow,
      })
    }
  })
})
