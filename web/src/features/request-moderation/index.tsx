import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Main } from '@/components/layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { useModerationPermission } from './api'
import { ModerationOverview } from './overview'
import { ModerationRecords } from './records'
import { ModerationRestrictions } from './restrictions'
import { ModerationSettings } from './settings'

export function RequestModeration() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('overview')
  const canConfigure = useModerationPermission('write')
  return (
    <Main>
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('Request moderation')}</h1>
          <p className='text-muted-foreground mt-2 text-sm'>
            {t(
              'Reviews run asynchronously. Restrictions apply only to future requests.'
            )}
          </p>
        </div>
        <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
          <TabsList className='h-auto flex-wrap justify-start'>
            <TabsTrigger value='overview'>{t('Overview')}</TabsTrigger>
            <TabsTrigger value='records'>{t('Moderation records')}</TabsTrigger>
            <TabsTrigger value='restrictions'>{t('Restrictions')}</TabsTrigger>
            {canConfigure && (
              <TabsTrigger value='settings'>{t('Settings')}</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value='overview'>
            {tab === 'overview' && <ModerationOverview />}
          </TabsContent>
          <TabsContent value='records'>
            {tab === 'records' && <ModerationRecords />}
          </TabsContent>
          <TabsContent value='restrictions'>
            {tab === 'restrictions' && <ModerationRestrictions />}
          </TabsContent>
          {canConfigure && (
            <TabsContent value='settings'>
              {tab === 'settings' && <ModerationSettings />}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Main>
  )
}
