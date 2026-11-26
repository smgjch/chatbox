import { describe, expect, it, vi } from 'vitest'
import type { GenerationPreparationRequest } from '@chatbox/core/generation'
import { createDefaultSettings } from '@chatbox/core/domain/settings'
import { createMessage } from '@shared/types'
import type { ModelDependencies } from '@shared/types/adapters'
import { prepareChatGeneration } from './chat-preparation'

vi.mock('@/adapters', () => ({
  createModelDependencies: async () => ({ storage: { getImage: async () => 'data:image/png;base64,dGVzdA==' } }),
}))
vi.mock('./ocr-helper', () => ({ getOCRModel: () => null, ocrImagesInMessages: vi.fn() }))

function request(vision = true): GenerationPreparationRequest<ModelDependencies> {
  return {
    session: {
      id: 'chat',
      name: 'Legacy session',
      type: 'chat',
      settings: {
        agentMode: { value: 'on', locked: true, lockReason: 'message_sent' },
        sessionPromptContextSnapshot: { soul: 'SECRET_PERSONA', memories: ['SECRET_MEMORY'] },
      },
    },
    messages: [
      createMessage('system', 'Use concise Chinese.'),
      createMessage('user', 'Summarize this file.'),
      createMessage('assistant', ''),
    ],
    targetMessageIndex: 2,
    settings: { provider: 'custom-gemini', modelId: 'gemini-4-argon' },
    globalSettings: { ...createDefaultSettings(), injectDefaultMetadata: false, memoryEnabled: true },
    config: { uuid: 'test' },
    model: {
      modelId: 'gemini-4-argon',
      apiStyle: 'google',
      isSupportVision: () => vision,
      isSupportSystemMessage: () => true,
    },
    modelContext: {},
    attachments: { read: async () => 'FULL_FILE_CONTENT' },
    signal: new AbortController().signal,
    agentModeValue: 'on',
    agentModeLocked: true,
    agentModeSupported: true,
    webBrowsing: true,
    lockAgentMode: vi.fn(),
    preserveLastPromptMessageToolCalls: false,
    providerOptions: { google: { thinkingConfig: { thinkingLevel: 'high' } } },
  } as unknown as GenerationPreparationRequest<ModelDependencies>
}

describe('plain chat generation', () => {
  it('preserves instructions and full local attachments while ignoring retired session features', async () => {
    const input = request()
    input.messages[1].files = [
      {
        id: 'doc',
        name: 'notes.txt',
        fileType: 'text/plain',
        storageKey: 'doc-content',
        ragMode: 'session-retrieval',
        sessionAttachmentId: 42,
      },
    ]
    const prepared = await prepareChatGeneration(input)
    const content = JSON.stringify(prepared.coreMessages)
    expect(content).toContain('Use concise Chinese.')
    expect(content).toContain('Summarize this file.')
    expect(content).toContain('FULL_FILE_CONTENT')
    expect(content).not.toContain('SECRET_PERSONA')
    expect(content).not.toContain('SECRET_MEMORY')
    expect(prepared.tools).toEqual({})
    expect(prepared.chatOptions.agentMode).toBe(false)
    expect(prepared.chatOptions.providerOptions).toEqual(input.providerOptions)
    expect(input.lockAgentMode).not.toHaveBeenCalled()
  })
  it('retains image input for vision models', async () => {
    const input = request()
    input.messages[1].contentParts.push({ type: 'image', storageKey: 'picture' })
    const prepared = await prepareChatGeneration(input)
    expect(JSON.stringify(prepared.coreMessages)).toContain('"type":"image"')
  })
  it('explains unsupported image input instead of silently discarding the image', async () => {
    const input = request(false)
    input.messages[1].contentParts.push({ type: 'image', storageKey: 'picture' })
    await expect(prepareChatGeneration(input)).rejects.toThrow('does not support images')
  })
  it('puts system instructions before user input for models without system messages', async () => {
    const input = request()
    input.model.isSupportSystemMessage = () => false
    const prepared = await prepareChatGeneration(input)
    expect(prepared.coreMessages.some((m) => m.role === 'system')).toBe(false)
    const content = JSON.stringify(prepared.coreMessages)
    expect(content.indexOf('Use concise Chinese.')).toBeLessThan(content.indexOf('Summarize this file.'))
  })
})
