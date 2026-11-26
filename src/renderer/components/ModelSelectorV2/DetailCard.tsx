import { Button, Flex, Stack, Text } from '@mantine/core'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { ModelIcon } from '../icons/ModelIcon'
import { CapabilityIconRow } from './CapabilityIconRow'
import { CARD_SURFACE_STYLE, getModelSelectorFloatingSurfaceClass } from './constants'
import type { DetailModel } from './types'

export function DetailCard({ model, onClose, mobile }: { model: DetailModel; onClose?: () => void; mobile?: boolean }) {
  const { t } = useTranslation()
  return (
    <Stack
      gap="md"
      className={clsx(
        'relative border border-solid text-chatbox-tint-primary',
        getModelSelectorFloatingSurfaceClass(!!mobile),
        mobile ? 'm-[4px] border-0 px-4 pb-4 pt-3 rounded-[12px]' : 'm-[4px] w-[320px] rounded-[12px] px-4 pb-4 pt-4'
      )}
      style={mobile ? undefined : CARD_SURFACE_STYLE}
    >
      <Flex align="center" gap="md">
        <ModelIcon providerId={model.providerId} modelId={model.modelId} size={mobile ? 34 : 30} />
        <Text fw={750} size={mobile ? 'xl' : 'lg'} lh={1.16} className="min-w-0 flex-1 break-words">
          {model.name}
        </Text>
      </Flex>
      {model.description && (
        <Text size={mobile ? 'md' : 'sm'} c="chatbox-secondary" className="leading-relaxed">
          {model.description}
        </Text>
      )}
      <Stack gap="xs" mt="sm">
        <Text size="sm" fw={750} c="chatbox-secondary">
          {t('Capabilities')}
        </Text>
        <CapabilityIconRow capabilities={model.capabilities} />
      </Stack>
      {model.disabledReason && (
        <Text size="sm" c="chatbox-tertiary" ta="center">
          {model.disabledReason}
        </Text>
      )}
      {onClose && (
        <Button variant="default" onClick={onClose}>
          {t('Close')}
        </Button>
      )}
    </Stack>
  )
}
