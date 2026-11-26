import type { Message } from '@shared/types'
import { GenericMessageError } from './GenericMessageError'
import { resolveMessageErrorPresentation } from './message-error-presentation'

export default function MessageErrTips({
  msg,
  onRetry,
}: {
  msg: Message
  sessionId?: string
  onRetry?: () => void | Promise<void>
}) {
  return msg.error ? (
    <GenericMessageError msg={msg} presentation={resolveMessageErrorPresentation(msg)} onRetry={onRetry} />
  ) : null
}
