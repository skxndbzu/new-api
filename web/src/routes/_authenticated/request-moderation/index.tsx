import { createFileRoute, redirect } from '@tanstack/react-router'

import { RequestModeration } from '@/features/request-moderation'
import { hasPermission } from '@/lib/admin-permissions'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/request-moderation/')({
  beforeLoad: () => {
    if (
      !hasPermission(
        useAuthStore.getState().auth.user,
        'request_moderation',
        'read'
      )
    ) {
      throw redirect({ to: '/403' })
    }
  },
  component: RequestModeration,
})
