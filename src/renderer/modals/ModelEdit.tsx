import { createModelDependencies } from '@/adapters'
import { AdaptiveSelect } from '@/components/AdaptiveSelect'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { AppTooltip as Tooltip } from '@/components/ui/tooltip'
import platform from '@/platform'
import { settingsStore } from '@/stores/settingsStore'
import { type ModelTestState, testModelCapabilities } from '@/utils/model-tester'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Button, Checkbox, Flex, Loader, NumberInput, Stack, Text, TextInput, UnstyledButton } from '@mantine/core'
import { TestId } from '@shared/automation/testids'
import { SystemProviders } from '@shared/defaults'
import type { ProviderModelInfo } from '@shared/types'
import { ModelProviderType } from '@shared/types'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const ModelEdit = NiceModal.create((props: { model?: ProviderModelInfo; providerId?: string }) => {
  const modal = useModal()
  const { t } = useTranslation()

  const isNew = !props.model
  const [modelId, setModelId] = useState(props.model?.modelId || '')
  const [nickname, setNickname] = useState(props.model?.nickname || '')
  const [capabilities, setCapabilities] = useState(props.model?.capabilities || [])
  const [type, setType] = useState<ProviderModelInfo['type']>(props.model?.type || 'chat')
  const [contextWindow, setContextWindow] = useState<number | undefined>(props.model?.contextWindow)
  const [maxOutput, setMaxOutput] = useState<number | undefined>(props.model?.maxOutput)
  const [thinkingMode, setThinkingMode] = useState<ProviderModelInfo['thinkingMode']>(
    props.model?.thinkingMode ?? 'auto'
  )
  const provider = [...SystemProviders(), ...(settingsStore.getState().customProviders ?? [])].find(
    (p) => p.id === props.providerId
  )
  const isGemini = provider?.type === ModelProviderType.Gemini || props.model?.apiStyle === 'google'
  const [testState, setTestState] = useState<ModelTestState>({
    testing: false,
  })

  const typeOptions = [{ value: 'chat', label: t('Chat')?.toString() ?? 'Chat' }]

  useEffect(() => {
    setModelId(props.model?.modelId || '')
    setNickname(props.model?.nickname || '')
    setCapabilities(props.model?.capabilities || [])
    setType(props.model?.type || 'chat')
    setContextWindow(props.model?.contextWindow)
    setMaxOutput(props.model?.maxOutput)
    setThinkingMode(props.model?.thinkingMode ?? 'auto')
    setTestState({ testing: false })
  }, [props])

  const handleTestModel = async () => {
    if (!modelId || !props.providerId) return

    const configs = await platform.getConfig()
    const dependencies = await createModelDependencies()

    await testModelCapabilities({
      providerId: props.providerId,
      modelId,
      settings: settingsStore.getState(),
      configs,
      dependencies,
      onStateChange: (state) => {
        setTestState(state)

        // Auto-enable capabilities based on test results
        if (state.visionTest?.status === 'success') {
          setCapabilities((prev = []) => (prev.includes('vision') ? prev : [...prev, 'vision']))
        }
        if (state.toolTest?.status === 'success') {
          setCapabilities((prev = []) => (prev.includes('tool_use') ? prev : [...prev, 'tool_use']))
        }
      },
    })
  }

  const handleCancel = () => {
    modal.resolve()
    modal.hide()
  }

  const handleSave = () => {
    modal.resolve({
      ...props.model,
      modelId,
      type,
      nickname: nickname || undefined,
      capabilities,
      contextWindow,
      maxOutput,
      thinkingMode,
    })
    modal.hide()
  }

  return (
    <AdaptiveModal
      keepMounted={false}
      opened={modal.visible}
      onClose={handleCancel}
      title={t('Edit Model')}
      centered={true}
      w={456}
    >
      <Stack data-testid={TestId.settings.providerModelEditor} gap="md">
        {/* Model ID & NickName */}
        <Stack gap="xs">
          <Flex align="center" gap="lg">
            <Stack gap={0}>
              <Text>{t('Model ID')}</Text>
              <Text className="select-none h-0 overflow-hidden opacity-0">{t('Nickname')}</Text>
            </Stack>
            <TextInput
              data-testid={TestId.settings.providerModelEditorId}
              disabled={!isNew}
              flex={1}
              value={modelId}
              onChange={(e) => setModelId(e.currentTarget.value)}
            />
          </Flex>
          <Flex align="center" gap="lg">
            <Stack gap={0}>
              <Text className="select-none h-0 overflow-hidden opacity-0">{t('Model ID')}</Text>
              <Text>{t('Nickname')}</Text>
            </Stack>
            <TextInput
              data-testid={TestId.settings.providerModelEditorNickname}
              placeholder={String(t('optional') ?? 'optional')}
              flex={1}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </Flex>
        </Stack>

        {/* Model Type */}
        <Stack gap="xs">
          <Text fw="600">{t('Model Type')}</Text>
          <AdaptiveSelect
            classNames={{ dropdown: 'pointer-events-auto' }}
            comboboxProps={{ withinPortal: false }}
            allowDeselect={false}
            styles={{
              label: {
                fontWeight: 400,
              },
            }}
            data={typeOptions}
            value={type}
            onChange={(v) => setType(v as ProviderModelInfo['type'])}
          />
        </Stack>

        {/* Capabilities */}
        {type === 'chat' && (
          <Stack gap="xs">
            <Text fw="600">{t('Capabilities')}</Text>
            <Flex align="center" gap="md">
              <Checkbox
                flex={1}
                label={t('Vision')}
                checked={capabilities?.includes('vision')}
                onChange={(e) => {
                  const checked = e.currentTarget.checked
                  if (checked) {
                    setCapabilities([...(capabilities || []), 'vision'])
                  } else {
                    setCapabilities([...(capabilities?.filter((c) => c !== 'vision') || [])])
                  }
                }}
              />
              <Checkbox
                flex={1}
                label={t('Reasoning')}
                checked={capabilities?.includes('reasoning')}
                onChange={(e) => {
                  const checked = e.currentTarget.checked
                  if (checked) {
                    setCapabilities([...(capabilities || []), 'reasoning'])
                  } else {
                    setCapabilities([...(capabilities?.filter((c) => c !== 'reasoning') || [])])
                  }
                }}
              />
            </Flex>
          </Stack>
        )}

        {/* Context Window and Max Output */}
        {isGemini && (
          <AdaptiveSelect
            label={t('Gemini thinking parameters')}
            description={t(
              'Use thinkingLevel for Gemini 3 and newer, or thinkingBudget for Gemini 2.5. Custom model names are supported.'
            )}
            value={thinkingMode}
            allowDeselect={false}
            data={[
              { value: 'auto', label: t('Auto') },
              { value: 'level', label: 'thinkingLevel (low / medium / high)' },
              { value: 'budget', label: 'thinkingBudget' },
              { value: 'none', label: t('Disabled') },
            ]}
            onChange={(value) => setThinkingMode(value as ProviderModelInfo['thinkingMode'])}
          />
        )}
        <Stack gap="xs">
          <Text fw="600">{t('Advanced Settings')}</Text>
          <Flex gap="md">
            <Stack gap="xs" flex={1}>
              <Text size="sm">{t('Context Window')}</Text>
              <NumberInput
                placeholder={String(t('e.g. 128000'))}
                value={contextWindow}
                onChange={(value) => setContextWindow(typeof value === 'number' ? value : undefined)}
                min={1}
                max={10_000_000}
                step={1000}
                thousandSeparator=","
                clampBehavior="strict"
              />
            </Stack>
            <Stack gap="xs" flex={1}>
              <Text size="sm">{t('Max Output Tokens')}</Text>
              <NumberInput
                placeholder={String(t('e.g. 4096'))}
                value={maxOutput}
                onChange={(value) => setMaxOutput(typeof value === 'number' ? value : undefined)}
                min={1}
                max={1_000_000}
                step={100}
                thousandSeparator=","
                clampBehavior="strict"
              />
            </Stack>
          </Flex>
        </Stack>

        <AdaptiveModal.Actions>
          {testState.basicTest?.status === 'success' ? (
            <Text c="chatbox-success" className="text-center">
              {t('Test successful')}
            </Text>
          ) : testState.basicTest?.status === 'error' ? (
            <Tooltip label={testState.basicTest.error} multiline maw={300} zIndex={3000} openOnTouch>
              <UnstyledButton
                type="button"
                c="chatbox-error"
                style={{ cursor: 'help', textAlign: 'center' }}
                className="inline-block"
              >
                {t('Test failed')}
              </UnstyledButton>
            </Tooltip>
          ) : null}
          <AdaptiveModal.CloseButton onClick={handleCancel} />
          <Button variant="light" onClick={handleTestModel}>
            {testState.testing ? <Loader size="xs" /> : t('Test Model')}
          </Button>
          <Button data-testid={TestId.settings.providerModelEditorSave} onClick={handleSave}>
            {t('Save')}
          </Button>
        </AdaptiveModal.Actions>
      </Stack>
    </AdaptiveModal>
  )
})

export default ModelEdit
