import { rendererApplication } from '@/app/renderer-application'
import HomepageIcon from '@/components/icons/HomepageIcon'
import InputBox, { type InputBoxPayload } from '@/components/InputBox/InputBox'
import { contentColumnContainerClassName } from '@/components/layout/contentColumn'
import Page from '@/components/layout/Page'
import { useProviders } from '@/hooks/useProviders'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { navigateToSettings } from '@/modals/settings-navigation'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'
import { switchCurrentSession } from '@/stores/session/crud'
import { submitNewUserMessage } from '@/stores/session/messages'
import { settingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import NiceModal from '@ebay/nice-modal-react'
import { Box, Button, Stack, Text } from '@mantine/core'
import { createMessage, type SessionHeader } from '@shared/types'
import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

export const Route = createFileRoute('/')({
  component: Index,
  validateSearch: zodValidator(z.object({ settings: z.string().optional(), folderId: z.string().optional() })),
})

function Index() {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const { folderId } = Route.useSearch()
  const widthFull = useUIStore((s) => s.widthFull)
  const { providers } = useProviders()
  const [session, setSession] = useState<SessionHeader>(() => {
    const { defaultChatModel } = settingsStore.getState()
    const model = defaultChatModel
      ? { provider: defaultChatModel.provider, modelId: defaultChatModel.model }
      : lastUsedModelStore.getState().chat
    return { id: 'new', name: 'Untitled', type: 'chat', threadName: '', settings: { ...model } }
  })
  const [systemPrompt, setSystemPrompt] = useState(() => settingsStore.getState().defaultPrompt || '')

  // Old defaults may refer to a removed account or provider. Pick a configured chat model.
  useEffect(() => {
    setSession((old) => {
      if (
        providers.some(
          (p) => p.id === old.settings?.provider && p.models?.some((m) => m.modelId === old.settings?.modelId)
        )
      )
        return old
      const provider = providers.find((p) => p.models?.length)
      return { ...old, settings: { ...old.settings, provider: provider?.id, modelId: provider?.models?.[0]?.modelId } }
    })
  }, [providers])

  const handleSubmit = useCallback(
    async ({ constructedMessage, needGenerating = true, onUserMessageReady, settingsPatch }: InputBoxPayload) => {
      const created = await rendererApplication.sessions.createSession({
        name: session.name,
        type: 'chat',
        folderId,
        messages: systemPrompt ? [createMessage('system', systemPrompt)] : [],
        threadName: session.threadName ?? '',
        settings: { ...session.settings, ...settingsPatch },
      })
      switchCurrentSession(created.id)
      localStorage.removeItem('new-chat')
      await submitNewUserMessage(created.id, { newUserMsg: constructedMessage, needGenerating, onUserMessageReady })
    },
    [session, systemPrompt, folderId]
  )

  const onClickSessionSettings = useCallback(async () => {
    const result: { session: SessionHeader; systemPrompt: string } | undefined = await NiceModal.show(
      'session-settings',
      { session, systemPrompt }
    )
    if (result) {
      setSession(result.session)
      setSystemPrompt(result.systemPrompt)
    }
    return !!result
  }, [session, systemPrompt])

  return (
    <Page title="">
      <div className={`flex flex-col h-full ${contentColumnContainerClassName(widthFull)}`}>
        <Stack align="center" justify="center" gap="sm" className="flex-1 min-h-0" py="xl">
          <HomepageIcon className="h-8" />
          <Text fw={600} size={isSmallScreen ? 'sm' : 'md'}>
            {t('What can I help you with today?')}
          </Text>
          {providers.length === 0 && (
            <Button variant="light" onClick={() => navigateToSettings('/provider')}>
              {t('Add provider')}
            </Button>
          )}
        </Stack>
        <Box>
          <InputBox
            sessionType="chat"
            sessionId="new"
            model={
              session.settings?.provider && session.settings?.modelId
                ? { provider: session.settings.provider, modelId: session.settings.modelId }
                : undefined
            }
            onSelectModel={(provider, modelId) =>
              setSession((old) => ({ ...old, settings: { ...old.settings, provider, modelId } }))
            }
            onClickSessionSettings={onClickSessionSettings}
            onSubmit={handleSubmit}
          />
        </Box>
      </div>
    </Page>
  )
}
