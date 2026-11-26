import { describe, expect, it } from 'vitest'
import { SettingsService } from '@chatbox/core/application/settings'
import { createDefaultSettings } from '@chatbox/core/domain/settings'
import { InMemorySettingsStorage } from '@chatbox/core/testing'
import { chatOnlySettings } from './chat-only'
import { getSystemProviders } from './providers/registry'
import './providers/builtin-registration'

describe('chat-only settings boundary', () => {
  it('sanitizes old backups while retaining configured chat providers and preferences', () => {
    const defaults = createDefaultSettings()
    const gateway = {
      apiKey: 'test-key',
      apiHost: 'https://example.com/v1beta',
      geminiAuthMode: 'bearer' as const,
      geminiStreaming: false,
      models: [{ modelId: 'gemini-4-argon', thinkingMode: 'level' as const }],
    }
    const result = chatOnlySettings({
      ...defaults,
      language: 'zh-Hans',
      temperature: 0.5,
      memoryEnabled: true,
      licenseKey: 'retired-license',
      autoUpdate: true,
      allowReportingAndTracking: true,
      providers: { 'chatbox-ai': { apiKey: 'retired' }, gateway },
      mcp: {
        servers: [{ id: 'old', name: 'old', enabled: true, transport: { type: 'stdio', command: 'unused', args: [] } }],
        enabledBuiltinServers: ['filesystem'],
      },
      skills: { ...defaults.skills, enabledSkillNames: ['old'] },
      defaultChatModel: { provider: 'chatbox-ai', model: 'old' },
    })
    expect(result.providers).toEqual({ gateway })
    expect(result.language).toBe('zh-Hans')
    expect(result.temperature).toBe(0.5)
    expect(result.defaultChatModel).toBeUndefined()
    expect(result.licenseKey).toBeUndefined()
    expect(result.memoryEnabled).toBe(false)
    expect(result.mcp.servers).toEqual([])
    expect(result.skills.enabledSkillNames).toEqual([])
    expect(result.extension?.documentParser).toEqual({ type: 'local' })
    expect(result.autoUpdate).toBe(false)
    expect(result.allowReportingAndTracking).toBe(false)
    expect(getSystemProviders().some((p) => p.id === 'chatbox-ai')).toBe(false)
  })

  it('enforces the policy on settings replacement, updates and persistence', async () => {
    const storage = new InMemorySettingsStorage()
    const service = new SettingsService(storage, { isDesktopLike: true })
    await service.hydrate()
    service.replaceSettings({
      ...service.getSettings(),
      memoryEnabled: true,
      licenseKey: 'legacy',
      providers: { 'chatbox-ai': { apiKey: 'legacy' }, openai: { apiKey: 'kept' } },
    })
    service.updateSettings({ memoryEnabled: true, autoUpdate: true, fontSize: 18 })
    await service.flushPersistence()
    expect(service.getSettings()).toMatchObject({
      memoryEnabled: false,
      autoUpdate: false,
      fontSize: 18,
      providers: { openai: { apiKey: 'kept' } },
    })
    const reloaded = new SettingsService(storage, { isDesktopLike: true })
    expect(await reloaded.hydrate()).toMatchObject({ memoryEnabled: false, fontSize: 18 })
    expect(reloaded.getSettings().licenseKey).toBeUndefined()
    expect(reloaded.getSettings().providers?.['chatbox-ai']).toBeUndefined()
  })
})
