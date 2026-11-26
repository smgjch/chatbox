import { rendererApplication } from '@/app/renderer-application'
import { sessionStartupRecovery } from '@/packages/session-startup-recovery'
import { clearSessionNameGenerationState, syncSessionAutoTitleOnOpen } from '@/stores/session/naming'
import { clearSessionActivity } from '@/stores/sessionActivityStore'
import { uiStore } from '@/stores/uiStore'
import type { SessionEventBus } from '@chatbox/core/application/session'

function cleanupDeletedSessionRuntimeState(sessionId: string): void {
  uiStore.getState().clearSessionWebBrowsing(sessionId)
  uiStore.getState().removeSessionKnowledgeBase(sessionId)
  uiStore.getState().clearSessionAgentMode(sessionId)
  uiStore.getState().clearSessionPanel(sessionId)
  clearSessionNameGenerationState(sessionId)
  clearSessionActivity(sessionId)
}

/**
 * Connects application events to Renderer-only cleanup. This is registered by
 * the Renderer composition root and is not part of the portable SessionService.
 */
export function registerSessionUiEffects(events: SessionEventBus): () => void {
  const unsubscribe = events.subscribe(async (event) => {
    if (event.type === 'session-will-delete') {
      for (const sessionId of event.ids) {
        rendererApplication.generationRuntime.abort(sessionId, undefined, 'session-deleted')
      }
      return
    }
    if (event.type === 'session-command-committed') {
      if (event.meta && !event.delta.header.hidden) {
        void syncSessionAutoTitleOnOpen(event.delta.header, () => true).catch((error: unknown) => {
          console.warn('Failed to synchronize session title:', error)
        })
      }
      return
    }
    if (event.type === 'session-deleted') {
      sessionStartupRecovery.forget(event.ids)
      for (const sessionId of event.ids) {
        cleanupDeletedSessionRuntimeState(sessionId)
      }
    }
  })
  return () => {
    unsubscribe()
  }
}
