import { describe, expect, it, vi } from 'vitest'
import { createInitialState, processStreamChunk } from '@chatbox/core/generation'
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
  const apiRequest = vi.fn<ModelDependencies['request']['apiRequest']>().mockImplementation(
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
    expect(JSON.parse(request.body as string).generationConfig?.thinkingConfig).toEqual({ includeThoughts: true })
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
  it.each([false, true])('preserves thought summaries and reported reasoning usage (stream=%s)', async (stream) => {
    const { model, apiRequest } = harness({}, stream)
    const response = {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ thought: true, text: 'Check both possible cases.' }, { text: 'The answer is 42.' }],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 23, totalTokenCount: 38 },
    }
    apiRequest.mockImplementation(
      async () =>
        new Response(stream ? `data: ${JSON.stringify(response)}\n\n` : JSON.stringify(response), {
          headers: { 'content-type': stream ? 'text/event-stream' : 'application/json' },
        })
    )
    const providerOptions = getReasoningProviderOptions(
      'custom-agihub',
      { modelId: 'gemini-4-argon', apiStyle: 'google' },
      'high'
    )
    // Exercise the same stream processor used to persist desktop chat messages,
    // including simulated streaming of generateContent JSON responses.
    let state = createInitialState()
    for await (const chunk of model.chatStream([{ role: 'user', content: 'Solve the problem.' }], {
      providerOptions,
    })) {
      state = (await processStreamChunk(chunk, state, { onFileReceived: vi.fn() })).state
    }
    expect(state.contentParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'reasoning', text: 'Check both possible cases.' }),
        expect.objectContaining({ type: 'text', text: 'The answer is 42.' }),
      ])
    )
    expect(state.usage).toMatchObject({ inputTokens: 10, outputTokens: 28, reasoningTokens: 23, totalTokens: 38 })
    expect(state.finishReason).toBe('stop')
  })
  it('preserves reasoning usage even when the gateway withholds thought summaries', async () => {
    const { model, apiRequest } = harness()
    apiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          ...reply,
          usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, thoughtsTokenCount: 23, totalTokenCount: 25 },
        }),
        { headers: { 'content-type': 'application/json' } }
      )
    )
    const result = await model.chat([{ role: 'user', content: 'Solve the problem.' }], {})
    expect(result.contentParts).toEqual([{ type: 'text', text: 'hello' }])
    expect(result.usage?.reasoningTokens).toBe(23)
  })
  it('delivers reasoning and answer deltas before the SSE connection closes', async () => {
    const { model, apiRequest } = harness({}, true)
    let response!: ReadableStreamDefaultController<Uint8Array>
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        response = controller
      },
    })
    apiRequest.mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/event-stream' } }))
    const encoder = new TextEncoder()
    const emit = (parts: Record<string, unknown>[], complete = false) =>
      response.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts }, ...(complete ? { finishReason: 'STOP' } : {}) }] })}\n\n`
        )
      )
    let state = createInitialState()
    let finished = false
    const consume = (async () => {
      for await (const chunk of model.chatStream([{ role: 'user', content: 'hi' }], {})) {
        state = (await processStreamChunk(chunk, state, { onFileReceived: vi.fn() })).state
      }
      finished = true
    })()
    try {
      emit([{ thought: true, text: 'Consider both cases.' }])
      await vi.waitFor(() =>
        expect(state.contentParts).toContainEqual(
          expect.objectContaining({ type: 'reasoning', text: 'Consider both cases.' })
        )
      )
      expect(finished).toBe(false)
      emit([{ text: 'First fragment. ' }])
      await vi.waitFor(() =>
        expect(state.contentParts).toContainEqual(expect.objectContaining({ type: 'text', text: 'First fragment. ' }))
      )
      expect(finished).toBe(false)
      emit([{ text: 'Last fragment.' }], true)
    } finally {
      response.close()
      await consume
    }
    expect(state.contentParts).toContainEqual(
      expect.objectContaining({ type: 'text', text: 'First fragment. Last fragment.' })
    )
    expect(finished).toBe(true)
  })
  it.each([false, true])(
    'distinguishes unreported reasoning usage from an explicit zero (stream=%s)',
    async (stream) => {
      for (const thoughtsTokenCount of [undefined, 0, 23]) {
        const { model, apiRequest } = harness({}, stream)
        const response = { ...reply, usageMetadata: { ...reply.usageMetadata, thoughtsTokenCount } }
        apiRequest.mockImplementation(
          async () =>
            new Response(stream ? `data: ${JSON.stringify(response)}\n\n` : JSON.stringify(response), {
              headers: { 'content-type': stream ? 'text/event-stream' : 'application/json' },
            })
        )
        let state = createInitialState()
        for await (const chunk of model.chatStream([{ role: 'user', content: 'hi' }], {})) {
          state = (await processStreamChunk(chunk, state, { onFileReceived: vi.fn() })).state
        }
        expect(state.usage?.reasoningTokens).toBe(thoughtsTokenCount)
      }
    }
  )
  it('does not ask for summaries when thinking is disabled or unsupported', async () => {
    const info: ProviderModelInfo = { modelId: 'gemini-2.5-flash', providerId: 'custom-agihub', apiStyle: 'google' }
    const { model, apiRequest } = harness({ model: info })
    await model.chat([{ role: 'user', content: 'hi' }], {
      providerOptions: getReasoningProviderOptions('custom-agihub', info, 'off'),
    })
    expect(JSON.parse(apiRequest.mock.calls[0][0].body as string).generationConfig.thinkingConfig).toEqual({
      includeThoughts: false,
      thinkingBudget: 0,
    })
    const unsupported = harness({ model: { ...info, thinkingMode: 'none' } })
    await unsupported.model.chat([{ role: 'user', content: 'hi' }], {})
    expect(
      JSON.parse(unsupported.apiRequest.mock.calls[0][0].body as string).generationConfig?.thinkingConfig
    ).toBeUndefined()
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
