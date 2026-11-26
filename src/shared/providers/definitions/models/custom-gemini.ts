import { createGoogle } from '@ai-sdk/google'
import type { CallChatCompletionOptions } from '../../../models/types'
import { createFetchWithProxy } from '../../../models/utils/fetch-proxy'
import type { ProviderSettings } from '../../../types'
import { normalizeGeminiHost } from '../../../utils/llm_utils'
import { GeminiModel, type GeminiModelOptions } from './gemini-base'

interface Options extends GeminiModelOptions {
  apiKey: string
  apiHost: string
  useProxy?: boolean
  geminiAuthMode?: ProviderSettings['geminiAuthMode']
  geminiIncludeModel?: boolean
}

export default class CustomGemini extends GeminiModel<Options> {
  public name = 'Custom Gemini'

  protected getRequestHeaders(_options?: CallChatCompletionOptions): Record<string, string> | undefined {
    return this.options.geminiAuthMode === 'bearer' ? { Authorization: `Bearer ${this.options.apiKey}` } : undefined
  }

  protected getProvider(options?: CallChatCompletionOptions) {
    const fetch = createFetchWithProxy(this.options.useProxy, this.dependencies)
    return createGoogle({
      // An empty key prevents the SDK from looking up GOOGLE_GENERATIVE_AI_API_KEY.
      // Remove the Google header at the transport edge for Bearer-only gateways.
      apiKey: this.options.geminiAuthMode === 'bearer' ? '' : this.options.apiKey,
      baseURL: normalizeGeminiHost(this.options.apiHost).apiHost,
      fetch: (url, init) => {
        const headers = new Headers(init?.headers)
        if (this.options.geminiAuthMode === 'bearer') headers.delete('x-goog-api-key')
        const includeModel = this.options.geminiIncludeModel ?? this.options.geminiAuthMode === 'bearer'
        const body =
          includeModel && typeof init?.body === 'string'
            ? JSON.stringify({ ...JSON.parse(init.body), model: this.options.model.modelId })
            : init?.body
        const requestHeaders: Record<string, string> = {}
        headers.forEach((value, name) => {
          requestHeaders[name] = value
        })
        return fetch(url, { ...init, headers: requestHeaders, body })
      },
      headers: this.getRequestHeaders(options),
    })
  }

  async listModels() {
    try {
      const { apiHost } = normalizeGeminiHost(this.options.apiHost)
      return await this.fetchModels({
        url: `${apiHost}/models`,
        method: 'GET',
        useProxy: this.options.useProxy,
        headers: this.getRequestHeaders() ?? { 'x-goog-api-key': this.options.apiKey },
      })
    } catch (error) {
      console.error('Failed to fetch Gemini models:', error)
      return []
    }
  }
}
