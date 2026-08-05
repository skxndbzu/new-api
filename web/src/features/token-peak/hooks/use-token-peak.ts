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
import { useQuery } from '@tanstack/react-query'

import {
  getTokenPeakConfig,
  getTokenPeakRecords,
  getTokenPeakToday,
} from '../api'

const THIRTY_SECONDS = 30 * 1000
const FIVE_MINUTES = 5 * 60 * 1000

export function useTokenPeak() {
  const configQuery = useQuery({
    queryKey: ['token-peak', 'config'],
    queryFn: getTokenPeakConfig,
    staleTime: THIRTY_SECONDS,
    refetchOnWindowFocus: true,
  })
  const enabled = configQuery.data?.data.enabled === true

  const todayQuery = useQuery({
    queryKey: ['token-peak', 'today'],
    queryFn: getTokenPeakToday,
    enabled,
    refetchInterval: THIRTY_SECONDS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: THIRTY_SECONDS,
  })

  const recordsQuery = useQuery({
    queryKey: ['token-peak', 'records'],
    queryFn: getTokenPeakRecords,
    enabled,
    refetchOnWindowFocus: true,
    staleTime: FIVE_MINUTES,
  })

  return { configQuery, todayQuery, recordsQuery }
}
