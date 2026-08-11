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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

type RankingAvatarProps = {
  name: string
  className?: string
  fallbackClassName?: string
}

export function RankingAvatar(props: RankingAvatarProps) {
  const fallback = [...props.name.trim()][0]?.toUpperCase() ?? '?'

  return (
    <Avatar className={cn('size-10', props.className)}>
      <AvatarFallback
        className={cn(
          'bg-primary/10 text-primary font-semibold',
          props.fallbackClassName
        )}
      >
        {fallback}
      </AvatarFallback>
    </Avatar>
  )
}
