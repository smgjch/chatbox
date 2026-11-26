import { type SentryErrorPriority } from '@shared/utils/sentry_policy'

export interface ReportErrorContext {
  domain: string
  extras?: Record<string, unknown>
  handled?: boolean
  operation: string
  priority?: SentryErrorPriority
  tags?: Record<string, string | number | boolean>
}

/**
 * Report an unexpected renderer failure with stable, searchable dimensions.
 * Expected user/API/network failures should stay in local logs and user-facing UI.
 */
export function reportError(error: unknown, context: ReportErrorContext): void {
  console.error('[' + context.domain + ':' + context.operation + ']', error)
}
