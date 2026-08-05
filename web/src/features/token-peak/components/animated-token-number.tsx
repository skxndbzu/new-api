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
import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { toIntlLocale } from '@/i18n/languages'

type AnimatedTokenNumberProps = {
  value: number
  className?: string
  suffix?: string
}

export function AnimatedTokenNumber(props: AnimatedTokenNumberProps) {
  const { i18n } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const numberRef = useRef<HTMLSpanElement>(null)
  const previousValueRef = useRef(props.value)
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(
        toIntlLocale(i18n.resolvedLanguage || i18n.language)
      ),
    [i18n.language, i18n.resolvedLanguage]
  )
  const label = `${formatter.format(props.value)}${props.suffix ?? ''}`

  useEffect(() => {
    const node = numberRef.current
    if (!node) return

    if (shouldReduceMotion) {
      node.textContent = label
      previousValueRef.current = props.value
      return
    }

    const controls = animate(previousValueRef.current, props.value, {
      duration: 0.7,
      ease: 'easeOut',
      onUpdate: (latest) => {
        node.textContent = `${formatter.format(Math.round(latest))}${props.suffix ?? ''}`
      },
    })
    previousValueRef.current = props.value
    return () => controls.stop()
  }, [formatter, label, props.suffix, props.value, shouldReduceMotion])

  return (
    <span className={props.className} aria-label={label}>
      <span ref={numberRef} aria-hidden>
        {label}
      </span>
    </span>
  )
}
