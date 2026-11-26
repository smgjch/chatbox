import { ErrorNotice } from '@/components/common/ErrorNotice'
import { useCopied } from '@/hooks/useCopied'
import { navigateToSettings } from '@/modals/settings-navigation'
import { Button, Flex, Text } from '@mantine/core'
import type { Message } from '@shared/types'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MessageErrorPresentation } from './message-error-presentation'

export function GenericMessageError({
  presentation,
  onRetry,
}: {
  msg: Message
  presentation: MessageErrorPresentation
  onRetry?: () => void | Promise<void>
}) {
  const { t } = useTranslation()
  const [retrying, setRetrying] = useState(false)
  const { copied, copy } = useCopied(presentation.errorMessage)
  const providerId = 'providerId' in presentation ? presentation.providerId : undefined
  return (
    <ErrorNotice icon="error">
      <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {presentation.errorMessage}
      </Text>
      <Flex gap="xs" mt="xs" wrap="wrap">
        {onRetry && (
          <Button
            size="compact-xs"
            variant="subtle"
            loading={retrying}
            onClick={async () => {
              setRetrying(true)
              try {
                await onRetry()
              } finally {
                setRetrying(false)
              }
            }}
          >
            {t('Retry')}
          </Button>
        )}
        <Button size="compact-xs" variant="subtle" onClick={() => copy()}>
          {t(copied ? 'Copied' : 'Copy')}
        </Button>
        <Button
          size="compact-xs"
          variant="subtle"
          onClick={() =>
            navigateToSettings(providerId && providerId !== 'chatbox-ai' ? `/provider/${providerId}` : '/provider')
          }
        >
          {t('Model Provider')}
        </Button>
      </Flex>
    </ErrorNotice>
  )
}
