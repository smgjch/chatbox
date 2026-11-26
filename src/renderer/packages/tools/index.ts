/** Display-only label for historical tool records. */
export function getToolName(toolName: string, _input?: unknown): string {
  return toolName.replace(/_/g, ' ')
}
