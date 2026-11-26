import Page from '@/components/layout/Page'
import useVersion from '@/hooks/useVersion'
import icon from '@/static/icon.png'
import { Anchor, Container, Flex, Image, Stack, Text, Title } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/about')({ component: About })
function About() {
  const { t } = useTranslation()
  const { version } = useVersion()
  return (
    <Page title={t('About')}>
      <Container size="md" py="xl">
        <Stack gap="lg">
          <Flex gap="lg" align="center">
            <Image src={icon} w={72} h={72} />
            <Stack gap={4}>
              <Title order={3}>Chatbox Lite</Title>
              <Text c="chatbox-secondary">{version}</Text>
            </Stack>
          </Flex>
          <Text>{t('Chat-only edition. Use your own model providers; conversations stay on your device.')}</Text>
          <Anchor href="https://github.com/smgjch/chatbox" target="_blank" rel="noreferrer">
            github.com/smgjch/chatbox
          </Anchor>
          <Text size="sm" c="chatbox-secondary">
            Based on Chatbox by Bin Huang and contributors. GPL-3.0.
          </Text>
          <Anchor href="https://github.com/chatboxai/chatbox" target="_blank" rel="noreferrer">
            Chatbox upstream
          </Anchor>
        </Stack>
      </Container>
    </Page>
  )
}
// Retained for legacy settings/story imports; updates are distributed by this fork.
export function UpdateSection(_props: { language: string; needCheckUpdate: boolean }) {
  return null
}
