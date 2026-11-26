import type { SentryAdapter, SentryScope } from '@shared/utils/sentry_adapter'
export class RendererSentryAdapter implements SentryAdapter {
  captureException(error: unknown): void {
    console.error(error)
  }
  withScope(callback: (scope: SentryScope) => void): void {
    callback({ setTag: () => undefined, setExtra: () => undefined })
  }
}
