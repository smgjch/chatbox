import type { AgentModeValue, MessageRole } from '../types'

/** Legacy mode types remain readable for imported conversations; the app always resolves to chat. */

export type SessionMode = 'chat' | 'work'

export type ModePolicyAction =
  /** Reply Again Below on user/system messages (flat alternative replies). */
  | 'reply-below'
  /** Open the editor for an assistant message. */
  | 'edit-assistant-message'
  /** Delete a single message. */
  | 'delete-message'
  /** Delete a saved fork branch (removes its messages). */
  | 'delete-fork'
  /** The editor's plain Save — editing without resending. */
  | 'save-message-edit'
  /** The conversation's own system prompt: shown in the transcript, edited in conversation settings. */
  | 'session-system-prompt'
  /** Queue a message while a reply streams. */
  | 'queue-message'
  /** Jump the queue and steer an item into the running generation. */
  | 'steer-queued-message'
  /** Archive the current conversation and start a new thread. */
  | 'create-thread'
  /** Open or navigate Thread History (toolbar, drawer, in-transcript labels). */
  | 'thread-history'

export function resolveSessionMode(_agentModeValue: AgentModeValue | undefined): SessionMode {
  return 'chat'
}

const WORK_MODE_UNAVAILABLE: ReadonlySet<ModePolicyAction> = new Set([
  'reply-below',
  'delete-fork',
  'save-message-edit',
  'session-system-prompt',
  'create-thread',
  'thread-history',
])

const CHAT_MODE_UNAVAILABLE: ReadonlySet<ModePolicyAction> = new Set(['queue-message', 'steer-queued-message'])

export function isActionAvailableInMode(action: ModePolicyAction, mode: SessionMode): boolean {
  return !(mode === 'work' ? WORK_MODE_UNAVAILABLE : CHAT_MODE_UNAVAILABLE).has(action)
}

/**
 * Work-mode assistant/system edits keep tool history and intermediate step
 * text intact: only the last visible output text is rewritten.
 */
export function shouldRestrictMessageEditToLastOutput(mode: SessionMode, role: MessageRole): boolean {
  return mode === 'work' && role !== 'user'
}
