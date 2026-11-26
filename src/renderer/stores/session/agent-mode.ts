import type { AgentModeEntry, AgentModeLockReason, AgentModeValue, SessionHeader } from '@shared/types'
/** Compatibility for imported session records. Every conversation is ordinary chat. */
export function createDefaultAgentModeEntry(_smartSwitchingDefault?: boolean): AgentModeEntry {
  return { value: 'off', locked: false, lockReason: null }
}
export function createNewChatAgentModeEntry(
  _lastSelected?: AgentModeValue,
  _smartSwitchingDefault?: boolean
): AgentModeEntry {
  return createDefaultAgentModeEntry()
}
export function getSessionAgentModeFromSession(
  _session: Pick<SessionHeader, 'settings'> | null | undefined
): AgentModeEntry {
  return createDefaultAgentModeEntry()
}
export function getSessionAgentModeEntry(
  _sessionId: string,
  _session?: Pick<SessionHeader, 'settings'> | null,
  _legacyMap?: Record<string, AgentModeEntry>
): AgentModeEntry {
  return createDefaultAgentModeEntry()
}
export function useSessionAgentMode(_sessionId: string): AgentModeEntry {
  return createDefaultAgentModeEntry()
}
export async function setSessionAgentMode(
  _sessionId: string,
  _value: AgentModeValue,
  _options: { source?: 'user' | 'system' } = {}
): Promise<AgentModeEntry> {
  return createDefaultAgentModeEntry()
}
export async function lockSessionAgentMode(
  _sessionId: string,
  _reason: Exclude<AgentModeLockReason, null>
): Promise<AgentModeEntry> {
  return createDefaultAgentModeEntry()
}
