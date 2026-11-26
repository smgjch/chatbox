import { createModelDependencies } from '@/adapters'
import { getModel } from '@shared/models'
import type { ModelInterface } from '@shared/models/types'
import type { Message, Settings } from '@shared/types'
import { ModelProviderEnum } from '@shared/types'
import type { ModelDependencies } from '@shared/types/adapters'
import { getModelSettings } from '@shared/utils/model_settings'
import type { ModelMessage } from 'ai'
import pMap from 'p-map'

/**
 * Resolve the OCR model from user settings.
 * Only the explicitly configured provider is used.
 * Returns null if no OCR model is available (caller decides how to handle).
 */
export function getOCRModel(
  globalSettings: Settings,
  configs: { uuid: string },
  dependencies: ModelDependencies
): { model: ModelInterface; providerName: string } | null {
  const hasUserOcrModel = !!(globalSettings.ocrModel?.provider && globalSettings.ocrModel?.model)

  if (!hasUserOcrModel || globalSettings.ocrModel?.provider === ModelProviderEnum.ChatboxAI) {
    return null
  }

  if (hasUserOcrModel) {
    // User has explicitly configured an OCR model — always respect their choice
    const ocrModelSetting = globalSettings.ocrModel!
    const modelSettings = getModelSettings(globalSettings, ocrModelSetting.provider, ocrModelSetting.model)
    return {
      model: getModel(modelSettings, globalSettings, configs, dependencies),
      providerName: ocrModelSetting.provider,
    }
  }

  return null
}

/**
 * Run OCR on all image parts in messages that don't yet have an ocrResult.
 * Mutates message contentParts in place (sets `ocrResult` on image parts).
 * Uses p-map with concurrency: 3 for parallel OCR processing.
 */
export async function ocrImagesInMessages(
  messages: Message[],
  ocrModel: ModelInterface,
  sessionId: string,
  persistResult?: (messageId: string, storageKey: string, text: string) => Promise<void>
): Promise<void> {
  const imageParts: Array<{
    messageId: string
    storageKey: string
    part: Message['contentParts'][number] & { type: 'image' }
  }> = []
  for (const msg of messages) {
    for (const part of msg.contentParts) {
      if (part.type === 'image' && !part.ocrResult) {
        imageParts.push({ messageId: msg.id, storageKey: part.storageKey, part })
      }
    }
  }

  if (imageParts.length === 0) return

  const dependencies = await createModelDependencies()

  await pMap(
    imageParts,
    async ({ messageId, storageKey, part }) => {
      const imageData = await dependencies.storage.getImage(storageKey)
      if (!imageData) return

      const ocrMsg: ModelMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'OCR the following image into Markdown.',
              'Tables should be formatted as HTML.',
              'Do not surround your output with triple backticks.',
            ].join(' '),
          },
          { type: 'image' as const, image: imageData },
        ],
      }
      const chatResult = await ocrModel.chat([ocrMsg], { sessionId })
      const text = chatResult.contentParts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('')

      part.ocrResult = text
      if (text) await persistResult?.(messageId, storageKey, text)
    },
    { concurrency: 3 }
  )
}
