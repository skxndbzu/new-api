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

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000

export type CountdownParts = {
  hours: number
  minutes: number
  seconds: number
}

export function getNextShanghaiSettlement(nowMs = Date.now()): number {
  const shanghaiNow = new Date(nowMs + SHANGHAI_OFFSET_MS)
  const nextSettlementAsUtc = Date.UTC(
    shanghaiNow.getUTCFullYear(),
    shanghaiNow.getUTCMonth(),
    shanghaiNow.getUTCDate(),
    0,
    10
  )
  const nextSettlement = nextSettlementAsUtc - SHANGHAI_OFFSET_MS

  if (nextSettlement > nowMs) return nextSettlement
  return nextSettlement + 24 * 60 * 60 * 1000
}

export function parseSettlementAt(value?: number | string | null): number {
  if (typeof value === 'number') {
    return value < 10_000_000_000 ? value * 1000 : value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return getNextShanghaiSettlement()
}

export function getCountdownParts(
  targetMs: number,
  nowMs = Date.now()
): CountdownParts {
  const totalSeconds = Math.max(0, Math.floor((targetMs - nowMs) / 1000))
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}
