import { rendererApplication } from '@/app/renderer-application'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { directoryFolderName, findDirectoryFolder } from '@chatbox/core/application/session'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Button, Stack, TextInput } from '@mantine/core'
import type { SessionFolder } from '@shared/types'
import { IconFolder } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { createSessionFolder } from '@/stores/session/folders'
import * as toastActions from '@/stores/toastActions'

const useSessionFolders = () => rendererApplication.sessionHooks.useSessionFolders()

/**
 * Creates a project; resolves the project, or `null` when cancelled. On desktop
 * a source folder can be attached, and the name then defaults to its basename.
 */
const SessionFolderCreate = NiceModal.create(() => {
  const modal = useModal()
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const { folders } = useSessionFolders()
  const [name, setName] = useState('')
  const [directory, setDirectory] = useState<string>()
  const [creating, setCreating] = useState(false)
  const canPickDirectory = false
  const trimmed = name.trim()
  const existing = findDirectoryFolder(folders ?? [], directory)
  const canCreate = !creating && (Boolean(trimmed) || directory !== undefined)

  const close = (result: SessionFolder | null) => {
    modal.resolve(result)
    modal.hide()
  }

  const create = async () => {
    if (!canCreate) return
    setCreating(true)
    try {
      close(await createSessionFolder(trimmed, directory))
    } catch (error) {
      console.error('Failed to create project:', error)
      toastActions.add(t('Failed to create project. Please try again.') || '')
      setCreating(false)
    }
  }

  return (
    <AdaptiveModal
      opened={modal.visible}
      onClose={() => close(null)}
      onExitTransitionEnd={modal.remove}
      centered
      title={t('New project')}
    >
      <Stack gap="md">
        <TextInput
          autoFocus={!isSmallScreen}
          aria-label={t('Project name') || undefined}
          placeholder={
            directory !== undefined && !existing
              ? directoryFolderName(directory, folders ?? [])
              : t('Project name') || undefined
          }
          leftSection={<ScalableIcon icon={IconFolder} size={16} />}
          value={existing ? existing.name : name}
          disabled={Boolean(existing)}
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void create()
            }
          }}
        />
      </Stack>
      <AdaptiveModal.Actions>
        <AdaptiveModal.CloseButton onClick={() => close(null)} />
        <Button disabled={!canCreate} loading={creating} onClick={() => void create()}>
          {existing ? t('Show project') : t('Create project')}
        </Button>
      </AdaptiveModal.Actions>
    </AdaptiveModal>
  )
})

export default SessionFolderCreate
