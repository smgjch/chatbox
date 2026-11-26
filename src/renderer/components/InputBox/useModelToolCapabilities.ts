import type { SessionSettings } from '@shared/types'

export function useModelToolCapabilities(
  _model: { provider: string; modelId: string } | undefined,
  _settings: SessionSettings
) {
  return {
    modelSupportsAgentMode: false,
    modelSupportToolUseForFile: false,
    isModelToolCapabilityFetched: true,
    isModelToolCapabilityLoading: false,
    isModelToolCapabilityError: false,
  }
}
