import { prepareChatGeneration } from '@/stores/session/chat-preparation'
import { SessionNotFoundError } from '@chatbox/core/application/session'
import {
  GenerationService,
  type GenerationServiceDependencies,
  type GenerationSessionPort,
  trySessionGenerationLock,
  withSessionGenerationLock,
} from '@chatbox/core/generation'
import type { LoggerPort } from '@chatbox/core/ports'

import type { ModelDependencies } from '@shared/types/adapters'

import { rendererApplication } from '@/app/renderer-application'
import { getLogger } from '@/lib/utils'

import { resolveCompactionBudget } from '@/packages/context-management/compaction-detector'
import { getConfiguredContextWindow, getEffectiveMaxOutputTokens } from '@/packages/context-management/context-pressure'

import platform from '@/platform'

import { settingsService } from '@/settings-runtime'
import { StorageKeyGenerator } from '@/storage/StoreStorage'

import { markFirstSuccessfulChatCompleted } from '@/stores/firstSuccessfulChat'

import { wakeQueuedUserMessages } from '@/stores/session/message-queue'
import {
  insertMessageAfter,
  modifyMessage,
  persistStreamingMessage,
  splitStreamingMessage,
  updateStreamingCache,
} from '@/stores/session/messages'

import { getSessionSettings } from '@/stores/session/session-settings'
import { registerSteeringConsumer } from '@/stores/session/steering'

import { handleGenerationError, initializeTargetMessage } from '@/stores/session/utils'
import { markSessionReplyCompleted, markSessionReplyFailed } from '@/stores/sessionActivityStore'

import { CurrentAttachmentAdapter } from './CurrentAttachmentAdapter'
import { CurrentBlobStorage } from './CurrentBlobStorage'
import { currentModelFactory } from './CurrentModelFactory'
import { CurrentPlatformCapabilities } from './CurrentPlatformCapabilities'
import { createModelDependencies } from './RendererModelDependencies'

const log = getLogger('generation-service')
const attachmentAdapter = new CurrentAttachmentAdapter()

const logger: LoggerPort = {
  log(level, message, context) {
    log.log(level, message, context)
  },
}

const sessions: GenerationSessionPort = {
  getSessionContextSource: (request) => rendererApplication.sessions.getSessionContextSource(request),
  readSessionMessages: (request) => rendererApplication.sessions.readSessionMessages(request),
  isSessionMissingError: (error) => error instanceof SessionNotFoundError,
  getSessionSettings: (sessionId, header) => getSessionSettings(sessionId, header),
  updateSessionSettings: async (sessionId, update) => {
    await rendererApplication.sessions.updateSessionHeader(sessionId, (current) => {
      if (!current) {
        throw new Error(`Session ${sessionId} not found`)
      }
      return { ...current, settings: update(current.settings) }
    })
  },
  initializeTargetMessage: (message, settings, globalSettings, sessionType) =>
    initializeTargetMessage(message, settings, globalSettings, sessionType),
  persistStreamingMessage: (sessionId, message, options) => persistStreamingMessage(sessionId, message, options),
  splitStreamingMessage,
  insertMessageAfter: async (sessionId, message, afterMessageId) => {
    await insertMessageAfter(sessionId, message, afterMessageId, { requireAnchor: true })
  },
  updateStreamingCache: (sessionId, message) => updateStreamingCache(sessionId, message),
  modifyMessage: (sessionId, message, refreshCounting, updateOnlyCache) =>
    modifyMessage(sessionId, message, refreshCounting, updateOnlyCache),
  handleGenerationError: (error, message, settings, context) =>
    handleGenerationError(error, message, settings, context),
}

const dependencies: GenerationServiceDependencies<ModelDependencies> = {
  sessions,
  settings: settingsService,
  models: {
    createModel(settings) {
      return currentModelFactory.createModel(settings)
    },
    async createContext(settings) {
      const context = await createModelDependencies()
      return {
        model: await currentModelFactory.createModel(settings, context),
        context,
      }
    },
    createWithContext(settings, context) {
      return currentModelFactory.createModel(settings, context)
    },
  },
  preparation: { prepare: prepareChatGeneration },
  tools: { buildToolsForPausedToolCall: async () => ({}) },
  coordination: {
    runExclusive: (sessionId, operation) => withSessionGenerationLock(sessionId, operation),
    tryRunExclusive: (sessionId, operation) => trySessionGenerationLock(sessionId, operation),
    wakeBackgroundTaskFollowUps: () => undefined,
  },
  steering: {
    register: (sessionId, conversationMessageIds) =>
      registerSteeringConsumer(sessionId, conversationMessageIds, (message, afterMessageId) =>
        // Fail closed: a steered user appended somewhere other than its anchor
        // would reorder the transcript. The consumer leaves the item queued for
        // the next boundary instead.
        insertMessageAfter(sessionId, message, afterMessageId, { requireAnchor: true })
      ),
    wake: (sessionId) => wakeQueuedUserMessages(sessionId),
  },
  compaction: {
    getBudget(sessionSettings, globalSettings) {
      const providerId = sessionSettings.provider ?? globalSettings.defaultChatModel?.provider
      const modelId = sessionSettings.modelId ?? globalSettings.defaultChatModel?.model
      if (!modelId) return null
      return resolveCompactionBudget(
        modelId,
        { compactionThreshold: globalSettings.compactionThreshold },
        getConfiguredContextWindow(globalSettings, providerId, modelId),
        getEffectiveMaxOutputTokens(globalSettings, providerId, modelId, sessionSettings.maxTokens)
      )
    },
    recordRequestOverhead(sessionId, overhead) {
      void import('@/packages/context-management/compaction').then(({ recordRequestOverhead }) =>
        recordRequestOverhead(sessionId, overhead)
      )
    },
    async compact(sessionId, request, abortSignal) {
      const { runCompactionWithUIState } = await import('@/packages/context-management/compaction')
      return runCompactionWithUIState(sessionId, request, { abortSignal })
    },
  },
  runtime: rendererApplication.generationRuntime,
  blobs: new CurrentBlobStorage(),
  attachments: attachmentAdapter,
  capabilities: new CurrentPlatformCapabilities(),
  host: {
    getConfig: () => platform.getConfig(),
    getKnowledgeBase: () => undefined,
    getWebBrowsing: () => false,
    getAgentModeEntry: () => ({ value: 'off', locked: false, lockReason: null }),
    setAgentMode: async () => undefined,
    lockAgentMode: async () => undefined,
    createPictureStorageKey: (sessionId, messageId) => StorageKeyGenerator.picture(`${sessionId}:${messageId}`),
    markFirstSuccessfulChatCompleted: () => markFirstSuccessfulChatCompleted(),
    afterMessageGenerated: (sessionId, message) => {
      markSessionReplyCompleted(sessionId, message)
    },
    afterMessageFailed: (sessionId, message) => markSessionReplyFailed(sessionId, message),
    now: Date.now,
  },
  analytics: {
    init: () => undefined,
    event: () => undefined,
    trackGenerate: () => undefined,
    trackSuggestionDecision: () => undefined,
    trackAgentModeSuggested: () => undefined,
    trackPauseAction: () => undefined,
    captureException: () => undefined,
  },
  logger,
}

/**
 * Current Renderer composition root for the host-neutral generation service.
 * React Native can compose the same service with native implementations of
 * these ports without importing Renderer state, storage, or platform modules.
 */
const generationService = new GenerationService(dependencies)

async function runGenerationWork(action: () => Promise<void>): Promise<void> {
  await action()
}

export const currentGenerationService = {
  orchestrate: (...args: Parameters<typeof generationService.orchestrate>) => generationService.orchestrate(...args),
  continuePausedToolCall: (...args: Parameters<typeof generationService.continuePausedToolCall>) =>
    runGenerationWork(() => generationService.continuePausedToolCall(...args)),
  disableToolCallLimitPauseAndContinue: (
    ...args: Parameters<typeof generationService.disableToolCallLimitPauseAndContinue>
  ) => runGenerationWork(() => generationService.disableToolCallLimitPauseAndContinue(...args)),
  stopPausedToolCall: (...args: Parameters<typeof generationService.stopPausedToolCall>) =>
    runGenerationWork(() => generationService.stopPausedToolCall(...args)),
  retryFromLastToolCallAfterApiError: (
    ...args: Parameters<typeof generationService.retryFromLastToolCallAfterApiError>
  ) => runGenerationWork(() => generationService.retryFromLastToolCallAfterApiError(...args)),
}
