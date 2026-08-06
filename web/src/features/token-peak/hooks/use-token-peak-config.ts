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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getTokenPeakConfig, updateTokenPeakConfig } from '../api'

export function useTokenPeakConfig() {
  const queryClient = useQueryClient()
  const configQuery = useQuery({
    queryKey: ['token-peak', 'config'],
    queryFn: getTokenPeakConfig,
    staleTime: 30 * 1000,
  })
  const updateConfig = useMutation({
    mutationFn: updateTokenPeakConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-peak'] })
    },
  })

  return { configQuery, updateConfig }
}
