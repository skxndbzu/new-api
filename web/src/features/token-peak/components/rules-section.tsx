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
import { useTranslation } from 'react-i18next'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export function RulesSection() {
  const { t } = useTranslation()
  const rules = [
    t('Daily Token usage is counted for the event.'),
    t('All event times use Beijing Time (Asia/Shanghai).'),
    t('Final settlement completes daily at 00:10.'),
    t('The configured top positions receive quota rewards.'),
    t('Ranking data may be delayed by several minutes.'),
    t('Abnormal traffic or usage manipulation is prohibited.'),
  ]

  return (
    <section className='bg-card ring-foreground/10 rounded-xl px-4 py-2 ring-1'>
      <Accordion>
        <AccordionItem value='rules' className='border-0'>
          <AccordionTrigger className='py-3.5 text-base'>
            {t('Event rules')}
          </AccordionTrigger>
          <AccordionContent>
            <ul className='text-muted-foreground grid gap-2 pb-2 text-sm sm:grid-cols-2'>
              {rules.map((rule) => (
                <li key={rule} className='flex gap-2'>
                  <span className='bg-primary mt-2 size-1.5 shrink-0 rounded-full' />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  )
}
