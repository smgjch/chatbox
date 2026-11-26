import { SettingRow, SettingsSection } from '@/components/settings/SettingsLayout'
import { Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'

/** Parser choice and its credentials, as one settings section. */
export function DocumentParserSettings() {
  const { t } = useTranslation()
  return (
    <SettingsSection title={t('Parser')}>
      <SettingRow
        id="parser-type"
        label={t('Parser Type')}
        description={t('Files are parsed locally and included in the chat context.')}
        control={<Text>{t('Local')}</Text>}
      />
    </SettingsSection>
  )
}

export default DocumentParserSettings
