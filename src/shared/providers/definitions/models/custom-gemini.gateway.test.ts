import { describe, expect, it, vi } from 'vitest'
import type { ModelDependencies } from '../../../types/adapters'
import type { ProviderModelInfo } from '../../../types'
import { ProviderSettingsSchema } from '../../../types'
import { normalizeGeminiHost } from '../../../utils/llm_utils'
import { getReasoningControlOptions, getReasoningProviderOptions } from '../../../utils/reasoning-control'
import CustomGemini from './custom-gemini'

const base = 'https://agihub.bytedance.net/api_proxy/auto_mode/call/v1beta'
const reply = {
  candidates: [{ content: { role: 'model', parts: [{ text: 'hello' }] }, finishReason: 'STOP' }],
  usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
}
function harness(options: Partial<ConstructorParameters<typeof CustomGemini>[0]> = {}, stream = false) {
  const apiRequest = vi
    .fn<ModelDependencies['request']['apiRequest']>()
    .mockImplementation(
      async () =>
        new Response(stream ? `data: ${JSON.stringify(reply)}\n\n` : JSON.stringify(reply), {
          headers: { 'content-type': stream ? 'text/event-stream' : 'application/json' },
        })
    )
  const deps: ModelDependencies = {
    request: { apiRequest, fetchWithOptions: vi.fn() },
    storage: { getImage: vi.fn(), saveImage: vi.fn() },
    sentry: { captureException: vi.fn(), withScope: vi.fn() },
    getRemoteConfig: () => ({}),
    platformType: 'desktop',
  }
  const model = new CustomGemini(
    {
      apiHost: base,
      apiKey: 'test-secret',
      geminiAuthMode: 'bearer',
      stream,
      model: { modelId: 'gemini-4-argon', providerId: 'custom-agihub', apiStyle: 'google' },
      ...options,
    },
    deps
  )
  return { model, apiRequest }
}

describe('custom Gemini gateways', () => {
  it.each([
    base,
    `${base}/`,
    `${base}/models/gemini-4-argon:generateContent`,
    `${base}/models/gemini-4-argon:streamGenerateContent?alt=sse`,
  ])('accepts %s without duplicating version or model segments', (url) => {
    expect(normalizeGeminiHost(url).apiHost).toBe(base)
  })
  it('adds a version only to unversioned hosts and prefixes', () => {
    expect(normalizeGeminiHost(' https://example.com/gateway/ ').apiHost).toBe('https://example.com/gateway/v1beta')
    expect(normalizeGeminiHost('https://example.com/v1').apiHost).toBe('https://example.com/v1')
  })
  it.each([false, true])('uses Bearer authentication and model in body (stream=%s)', async (stream) => {
    const { model, apiRequest } = harness({}, stream)
    const result = await model.chat([{ role: 'user', content: 'hi' }], {})
    expect(result.contentParts).toContainEqual({ type: 'text', text: 'hello' })
    const request = apiRequest.mock.calls[0][0]
    expect(request.url).toBe(
      `${base}/models/gemini-4-argon:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`
    )
    expect(request.headers).toMatchObject({ authorization: 'Bearer test-secret' })
    expect(new Headers(request.headers).has('x-goog-api-key')).toBe(false)
    expect(JSON.parse(request.body as string)).toMatchObject({
      model: 'gemini-4-argon',
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
    })
    expect(JSON.parse(request.body as string).generationConfig?.thinkingConfig).toBeUndefined()
  })
  it('preserves Google header auth without putting secrets in the URL', async () => {
    const { model, apiRequest } = harness({ geminiAuthMode: 'google-api-key' })
    await model.chat([{ role: 'user', content: 'hi' }], {})
    const request = apiRequest.mock.calls[0][0]
    expect(new Headers(request.headers).get('x-goog-api-key')).toBe('test-secret')
    expect(new Headers(request.headers).has('authorization')).toBe(false)
    expect(JSON.parse(request.body as string).model).toBeUndefined()
    expect(request.url).not.toContain('test-secret')
  })
  it.each(['low', 'medium', 'high'] as const)(
    'sends selected %s effort for Gemini 4 and custom aliases',
    async (effort) => {
      for (const modelId of ['gemini-4-argon', 'my-private-model']) {
        const info: ProviderModelInfo = {
          modelId,
          providerId: 'custom-agihub',
          apiStyle: 'google',
          thinkingMode: 'level',
        }
        const { model, apiRequest } = harness({ model: info })
        const providerOptions = getReasoningProviderOptions('custom-agihub', info, effort)
        await model.chat([{ role: 'user', content: 'hi' }], { providerOptions })
        const body = JSON.parse(apiRequest.mock.calls[0][0].body as string)
        expect(body.generationConfig.thinkingConfig).toMatchObject({ thinkingLevel: effort, includeThoughts: true })
        expect(body.generationConfig.thinkingConfig.thinkingBudget).toBeUndefined()
        expect(body.reasoning_effort).toBeUndefined()
      }
    }
  )
  it('exposes default/low/medium/high for Gemini 4 without a metadata capability flag', () => {
    expect(
      getReasoningControlOptions('custom-agihub', { modelId: 'gemini-4-argon', apiStyle: 'google' }).map((o) => o.level)
    ).toEqual(['default', 'low', 'medium', 'high'])
  })
  it('uses budgets for Gemini 2.5 and can explicitly disable unsupported aliases', async () => {
    const info: ProviderModelInfo = { modelId: 'gemini-2.5-flash', providerId: 'custom-agihub', apiStyle: 'google' }
    const { model, apiRequest } = harness({ model: info })
    await model.chat([{ role: 'user', content: 'hi' }], {
      providerOptions: getReasoningProviderOptions('custom-agihub', info, 'medium'),
    })
    expect(JSON.parse(apiRequest.mock.calls[0][0].body as string).generationConfig.thinkingConfig).toMatchObject({
      thinkingBudget: 8192,
    })
    expect(getReasoningControlOptions('custom-agihub', { ...info, thinkingMode: 'none' })).toEqual([])
  })
  it('retains gateway configuration through settings validation', () => {
    const setting = {
      geminiAuthMode: 'bearer',
      geminiIncludeModel: true,
      geminiStreaming: false,
      apiHost: base,
      models: [{ modelId: 'gemini-4-argon', thinkingMode: 'level' }],
    }
    expect(ProviderSettingsSchema.parse(setting)).toEqual(setting)
  })
})
