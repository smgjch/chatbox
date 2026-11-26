import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Alert, Stack, Text } from '@mantine/core'
import {
  LOCAL_PARSER_FILE_TOO_LARGE_ERROR,
  LOCAL_PARSER_MAX_PDF_FILE_SIZE_LABEL,
  LOCAL_PARSER_PDF_PASSWORD_PROTECTED_ERROR,
} from '@shared/file-parse-errors'
import { useTranslation } from 'react-i18next'
const FileParseError = NiceModal.create(({ errorCode, fileName }: { errorCode: string; fileName?: string }) => {
  const modal = useModal()
  const { t } = useTranslation()
  const close = () => {
    modal.resolve()
    modal.hide()
  }
  const message =
    errorCode === LOCAL_PARSER_PDF_PASSWORD_PROTECTED_ERROR
      ? t('This PDF is password-protected, so its content cannot be read. Remove the password and upload it again.')
      : errorCode === LOCAL_PARSER_FILE_TOO_LARGE_ERROR
        ? t('This PDF is too large to process (max {{size}}). Please upload a smaller file.', {
            size: LOCAL_PARSER_MAX_PDF_FILE_SIZE_LABEL,
          })
        : t('Failed to parse file. Please try again or use a different file format.')
  return (
    <AdaptiveModal
      opened={modal.visible}
      onClose={close}
      onExitTransitionEnd={modal.remove}
      centered
      title={t('File Processing Error')}
    >
      <Stack gap="md">
        {fileName && <Text size="sm">{fileName}</Text>}
        <Alert color="orange">{message}</Alert>
        <Text size="xs" c="dimmed">
          {errorCode}
        </Text>
      </Stack>
      <AdaptiveModal.Actions>
        <AdaptiveModal.CloseButton onClick={close} />
      </AdaptiveModal.Actions>
    </AdaptiveModal>
  )
})
export default FileParseError
