import { ApiError, OCRError } from '@shared/models/errors'
import { sequenceMessages } from '@shared/utils/message'
import { insertTimeGapReminders } from '@shared/utils/system-reminder'
import { getOCRModel, ocrImagesInMessages } from './ocr-helper'
import type { GenerationPreparationRequest, PreparedGeneration } from '@chatbox/core/generation'
import { buildContext, flattenToolCallPartsToText, selectMessagesBeforeTarget } from '@shared/context'
import type { ModelDependencies } from '@shared/types/adapters'
import { resolveReasoningReplayPolicy } from '@shared/utils/reasoning-control'
import {
  convertToModelMessages,
  buildModelSystemPrompt,
  injectModelSystemPrompt,
} from '@/packages/model-calls/message-utils'

/** Chat-only preparation. Historical feature settings never become tools or prompt instructions. */
export async function prepareChatGeneration(
  request: GenerationPreparationRequest<ModelDependencies>
): Promise<PreparedGeneration> {
  const { model, settings, globalSettings, session, signal } = request
  const attachmentPolicy = { modelSupportToolUseForFile: false, sandboxMode: false }
  const promptMessages = flattenToolCallPartsToText(
    await buildContext(selectMessagesBeforeTarget(request.messages, request.targetMessageIndex, false), {
      attachmentResolver: request.attachments,
      compactionPoints: request.compactionPoints,
      ...attachmentPolicy,
      maxContextMessageCount: settings.maxContextMessageCount,
      language: globalSettings.language,
    })
  )
  const infoParts: PreparedGeneration['infoParts'] = []
  if (
    !model.isSupportVision() &&
    promptMessages.some((message) => message.contentParts.some((part) => part.type === 'image' && !part.ocrResult))
  ) {
    const ocr = getOCRModel(globalSettings, request.config, request.modelContext)
    if (!ocr)
      throw new ApiError(
        'This model does not support images. Select a vision model or configure an OCR model in Settings.'
      )
    try {
      await ocrImagesInMessages(promptMessages, ocr.model, session.id)
    } catch (error) {
      throw new OCRError(ocr.providerName, error instanceof Error ? error : new Error(String(error)))
    }
  }
  const systemPrompt =
    globalSettings.injectDefaultMetadata !== false
      ? buildModelSystemPrompt(model.modelId, '', { conversationStartedAt: request.messages[0]?.timestamp })
      : undefined
  let messages = systemPrompt
    ? injectModelSystemPrompt(model.modelId, promptMessages, '', 'system', systemPrompt)
    : promptMessages
  if (globalSettings.injectDefaultMetadata !== false) {
    messages = insertTimeGapReminders(messages, { anchorTimestamp: request.messages[0]?.timestamp })
  }
  if (!model.isSupportSystemMessage())
    messages = messages.map((message) => ({ ...message, role: message.role === 'system' ? 'user' : message.role }))
  messages = sequenceMessages(messages)
  const coreMessages = await convertToModelMessages(messages, {
    modelSupportVision: model.isSupportVision(),
    ...resolveReasoningReplayPolicy(
      settings.provider,
      { modelId: model.modelId, apiStyle: model.apiStyle },
      model.reasoningReplaySource
    ),
  })
  return {
    promptMessages,
    coreMessages,
    tools: {},
    chatOptions: { sessionId: session.id, signal, providerOptions: request.providerOptions, agentMode: false },
    infoParts,
    fallbackToolCallPart: undefined,
    systemPrompt,
    attachmentPolicy,
  }
}
