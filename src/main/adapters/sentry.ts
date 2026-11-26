import log from 'electron-log/main'
import type { SentryAdapter, SentryScope } from '../../shared/utils/sentry_adapter'

/** Keep the existing error-reporting interface, using local logs only. */
export class MainSentryAdapter implements SentryAdapter {
  captureException(error: unknown): void {
    log.error(error)
  }
  withScope(callback: (scope: SentryScope) => void): void {
    callback({ setTag: () => undefined, setExtra: () => undefined })
  }
}
export const sentry = new MainSentryAdapter()
export async function flushSentry(_timeout: number): Promise<boolean> {
  return true
}
