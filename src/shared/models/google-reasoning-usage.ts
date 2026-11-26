import type { LanguageModelV4, LanguageModelV4StreamPart, LanguageModelV4Usage } from '@ai-sdk/provider'
import { wrapLanguageModel } from 'ai'

function reportedUsage(usage: LanguageModelV4Usage): LanguageModelV4Usage {
  const count = usage.raw?.thoughtsTokenCount
  // The Google SDK defaults omitted counts to zero. Keep missing usage unknown
  // so the UI does not mistake an unreported count for disabled reasoning.
  const reasoning = typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : undefined
  return { ...usage, outputTokens: { ...usage.outputTokens, reasoning } }
}

export function withGoogleReasoningUsage(model: LanguageModelV4): LanguageModelV4 {
  return wrapLanguageModel({
    model,
    middleware: {
      specificationVersion: 'v4',
      wrapGenerate: async ({ doGenerate }) => {
        const result = await doGenerate()
        return { ...result, usage: reportedUsage(result.usage) }
      },
      wrapStream: async ({ doStream }) => {
        const result = await doStream()
        return {
          ...result,
          stream: result.stream.pipeThrough(
            new TransformStream<LanguageModelV4StreamPart, LanguageModelV4StreamPart>({
              transform(part, controller) {
                controller.enqueue(part.type === 'finish' ? { ...part, usage: reportedUsage(part.usage) } : part)
              },
            })
          ),
        }
      },
    },
  })
}
