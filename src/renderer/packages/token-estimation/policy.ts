import type { SessionSettings } from '@shared/types'

// Match chat-preparation: attachments are inlined, with no tools or sandbox prompt.
export async function resolveTokenSandboxMode(_enabled: boolean, _supportsAgent: boolean, _settings: SessionSettings) {
  return false
}
export async function resolveTokenEstimationPolicy(_settings: SessionSettings, _workMode: boolean) {
  return { modelSupportToolUseForFile: false, sandboxMode: false }
}
