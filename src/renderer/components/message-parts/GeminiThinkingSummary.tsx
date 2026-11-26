import { ActionIcon, Box, Collapse, Group, Text, UnstyledButton } from '@mantine/core'
import type { Message } from '@shared/types'
import { getGoogleThinkingMode } from '@shared/utils/google-thinking'
import { IconBulb, IconChevronDown, IconCopy } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '../common/ScalableIcon'

export function getGeminiThinkingSummary(message: Message) {
  if (message.role !== 'assistant') return null
  const recorded = message.reasoningSummaryRequested !== undefined
  if (!recorded && getGoogleThinkingMode(message.modelId || message.model || '') === 'none') return null
  const summary = [
    message.reasoningContent,
    ...message.contentParts.filter((part) => part.type === 'reasoning').map((part) => part.text),
  ]
    .filter((text) => text?.trim())
    .join('\n\n')
  const count = message.usage?.reasoningTokens
  // Before summary diagnostics were introduced the SDK synthesized zero for
  // omitted usage. Only positive counts in those historical replies are evidence.
  const tokens =
    count !== undefined && Number.isSafeInteger(count) && count >= 0 && (recorded || count > 0) ? count : undefined
  if (!summary && (message.error || message.finishReason === 'canceled')) return null
  if (message.reasoningSummaryRequested === false && !summary && !tokens) return null
  return { summary, tokens }
}

/** Displays only native server data; never generates or infers a thinking summary. */
export function GeminiThinkingSummary({
  message,
  onCopy,
}: {
  message: Message
  onCopy: (text: string) => (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const data = getGeminiThinkingSummary(message)
  if (!data) return null
  const { summary, tokens } = data
  return (
    <Box my={8} mb={12} data-testid="gemini-thinking-summary">
      <Group gap={8} wrap="nowrap">
        <UnstyledButton
          onClick={summary ? () => setExpanded((value) => !value) : undefined}
          aria-expanded={summary ? expanded : undefined}
          aria-label={t('Thinking summary')}
          disabled={!summary}
          style={{ cursor: summary ? 'pointer' : 'default' }}
        >
          <Group gap={8} wrap="nowrap">
            <ScalableIcon icon={IconBulb} size={16} className="text-chatbox-tint-tertiary" />
            <Text size="xs" c="chatbox-secondary">
              {t('Thinking summary')}
            </Text>
            {summary && (
              <ScalableIcon
                icon={IconChevronDown}
                size={13}
                className={`text-chatbox-tint-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            )}
          </Group>
        </UnstyledButton>
        {tokens !== undefined && (
          <Text size="xs" c="chatbox-tertiary">
            {t('Reasoning tokens: {{tokens}}', { tokens })}
          </Text>
        )}
        {expanded && summary && (
          <ActionIcon
            variant="subtle"
            size="xs"
            c="chatbox-gray"
            aria-label={t('Copy reasoning content')}
            onClick={onCopy(summary)}
          >
            <ScalableIcon icon={IconCopy} size={12} />
          </ActionIcon>
        )}
      </Group>
      {!summary && (
        <Text size="xs" c="chatbox-tertiary" ml={24} mt={4}>
          {message.generating
            ? t('Waiting for a server thinking summary…')
            : t('The server did not provide a thinking summary.')}
        </Text>
      )}
      {!message.generating && tokens === undefined && (
        <Text size="xs" c="chatbox-tertiary" ml={24} mt={4}>
          {t('Reasoning usage was not provided.')}
        </Text>
      )}
      <Collapse in={expanded && !!summary}>
        <Text
          size="sm"
          c="chatbox-tertiary"
          mt={8}
          ml={24}
          pl={12}
          style={{
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            maxHeight: 400,
            overflowY: 'auto',
            borderLeft: '1px solid var(--chatbox-border-primary)',
          }}
        >
          {summary}
        </Text>
      </Collapse>
    </Box>
  )
}
