import type { GoogleLanguageModelOptions, GoogleProvider } from '@ai-sdk/google'
import type { LanguageModelV4 } from '@ai-sdk/provider'
import AbstractAISDKModel, { type CallSettings } from '../../../models/abstract-ai-sdk'
import { ApiError } from '../../../models/errors'
import type { CallChatCompletionOptions } from '../../../models/types'
import type { ProviderModelInfo } from '../../../types'
import type { ModelDependencies } from '../../../types/adapters'
import { getGoogleThinkingMode, normalizeGoogleThinkingConfig } from '../../../utils/google-thinking'
import { withGoogleReasoningUsage } from '../../../models/google-reasoning-usage'

export interface GeminiModelOptions {
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxOutputTokens?: number
  stream?: boolean
}

export abstract class GeminiModel<TOptions extends GeminiModelOptions> extends AbstractAISDKModel {
  constructor(
    public options: TOptions,
    dependencies: ModelDependencies
  ) {
    super(options, dependencies)
    this.injectDefaultMetadata = false
  }

  protected abstract getProvider(options?: CallChatCompletionOptions): GoogleProvider

  public isSupportReasoning() {
    return getGoogleThinkingMode(this.options.model.modelId, this.options.model.thinkingMode) !== 'none'
  }

  isSupportSystemMessage() {
    return ![
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash-thinking-exp',
      'gemini-2.0-flash-exp-image-generation',
      'gemini-2.5-flash-image-preview',
    ].includes(this.options.model.modelId)
  }

  protected getChatModel(options: CallChatCompletionOptions): LanguageModelV4 {
    const provider = this.getProvider(options)

    return withGoogleReasoningUsage(provider.chat(this.options.model.modelId))
  }

  protected getCallSettings(options: CallChatCompletionOptions): CallSettings {
    const isModelSupportThinking = this.isSupportReasoning()
    let providerParams: GoogleLanguageModelOptions = {
      safetySettings: [
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      ],
    }
    const { thinkingConfig, ...googleOptions } = options.providerOptions?.google || {}
    if (isModelSupportThinking) {
      // Ask for native summaries even at the provider's default effort. Do not
      // pass an empty config to the normalizer: it would choose a thinking level.
      const normalizedThinkingConfig = thinkingConfig
        ? normalizeGoogleThinkingConfig(this.options.model.modelId, thinkingConfig, this.options.model.thinkingMode)
        : { includeThoughts: true }
      providerParams = {
        ...providerParams,
        ...googleOptions,
        ...(normalizedThinkingConfig ? { thinkingConfig: { includeThoughts: true, ...normalizedThinkingConfig } } : {}),
      }
    }

    const settings: CallSettings = {
      temperature: this.options.temperature,
      topP: this.options.topP,
      maxOutputTokens: this.options.maxOutputTokens,
      providerOptions: {
        google: {
          ...providerParams,
        } satisfies GoogleLanguageModelOptions,
      },
    }

    return settings
  }

  protected async fetchModels(
    request: Parameters<ModelDependencies['request']['apiRequest']>[0]
  ): Promise<ProviderModelInfo[]> {
    type Response = {
      models: {
        name: string
        version: string
        displayName: string
        description: string
        inputTokenLimit: number
        outputTokenLimit: number
        supportedGenerationMethods: string[]
        temperature: number
        topP: number
        topK: number
      }[]
    }
    const res = await this.dependencies.request.apiRequest(request)
    const json: Response = await res.json()
    if (!json.models) {
      throw new ApiError(JSON.stringify(json))
    }
    return json.models
      .filter((m) => m.supportedGenerationMethods.some((method) => method.includes('generate')))
      .filter((m) => m.name.includes('gemini'))
      .map((m) => ({
        modelId: m.name.replace('models/', ''),
        nickname: m.displayName,
        type: 'chat' as const,
        contextWindow: m.inputTokenLimit,
        maxOutput: m.outputTokenLimit,
      }))
      .sort((a, b) => a.modelId.localeCompare(b.modelId))
  }
}
