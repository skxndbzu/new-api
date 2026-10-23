import { useMutation, useQueryClient } from '@tanstack/react-query'

import { hasPermission } from '@/lib/admin-permissions'
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

export const moderationKey = ['request_moderation'] as const

export async function moderationGet<T>(
  path: string,
  params?: Record<string, string | number | boolean>
): Promise<T> {
  const response = await api.get<{ success: boolean; data: T }>(
    `/api/request_moderation${path}`,
    { params }
  )
  return requireServerSuccess(response.data).data
}

export function useModerationMutation<T>(
  path: string,
  method: 'post' | 'put' = 'post'
) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (body: T) => {
      const response = await api[method]<{ success: boolean; data: unknown }>(
        `/api/request_moderation${path}`,
        body
      )
      return requireServerSuccess(response.data).data
    },
    onSuccess: () => client.invalidateQueries({ queryKey: moderationKey }),
  })
}

export function useModerationPermission(action: string): boolean {
  const user = useAuthStore((s) => s.auth.user)
  return hasPermission(user, 'request_moderation', action)
}
