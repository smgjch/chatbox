import { AdaptiveSelect } from '@/components/AdaptiveSelect'
import { SettingRow, SettingsPage, SettingsSection } from '@/components/settings/SettingsLayout'
import { useProviders } from '@/hooks/useProviders'
import { useSettingsStore } from '@/stores/settingsStore'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/settings/default-models')({ component: RouteComponent })

const slots = [
  {
    key: 'defaultChatModel',
    label: 'Default chat model',
    description: 'Used for new chats. You can choose a different model in each chat.',
  },
  {
    key: 'threadNamingModel',
    label: 'Fast model',
    description: 'Used to automatically generate conversation titles. Choose a model with fast responses.',
  },
  {
    key: 'ocrModel',
    label: 'Image text recognition (OCR)',
    description: 'Extracts text from images when the chat model cannot read them directly.',
  },
] as const

export function RouteComponent() {
  const { t } = useTranslation()
  const { providers } = useProviders()
  const settings = useSettingsStore((s) => s)
  const models = providers.flatMap((p) =>
    (p.models ?? []).map((m) => ({
      value: JSON.stringify([p.id, m.modelId]),
      label: `${p.name} / ${m.nickname || m.modelId}`,
    }))
  )
  return (
    <SettingsPage title={t('Default Models')}>
      <SettingsSection title={t('Default Models')}>
        {slots.map(({ key, label, description }) => (
          <SettingRow
            key={key}
            id={key}
            label={t(label)}
            description={t(description)}
            controlLayout="block"
            control={(fieldId) => (
              <AdaptiveSelect
                id={fieldId}
                searchable
                clearable
                aria-label={t(label) ?? undefined}
                placeholder={key === 'ocrModel' ? t('None')! : t('Auto')!}
                value={settings[key] ? JSON.stringify([settings[key]!.provider, settings[key]!.model]) : null}
                data={models}
                onChange={(value) => {
                  const [provider, model] = value ? (JSON.parse(value) as [string, string]) : []
                  settings.setSettings({ [key]: provider && model ? { provider, model } : undefined })
                }}
              />
            )}
          />
        ))}
      </SettingsSection>
    </SettingsPage>
  )
}
