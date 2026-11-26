import type { MessageToolCallPart } from '@shared/types'
import type { FC } from 'react'

export type ToolCallActionContext = { sessionId?: string; messageId?: string }

/** Historical tool records remain readable, with no execution or approval controls. */
export const ToolCallPartUI: FC<{ part: MessageToolCallPart } & ToolCallActionContext> = ({ part }) => (
  <details className="my-2 text-sm text-chatbox-tint-secondary">
    <summary>{part.toolName}</summary>
    <pre className="whitespace-pre-wrap break-words overflow-auto max-h-80">
      {JSON.stringify(part.state === 'result' ? part.result : part.args, null, 2)}
    </pre>
  </details>
)

export const TimelineToolCallStep: FC<{ part: MessageToolCallPart; nested?: boolean } & ToolCallActionContext> =
  ToolCallPartUI
export const WebSearchGroupUI: FC<{ parts: MessageToolCallPart[] }> = ({ parts }) => (
  <>
    {parts.map((part) => (
      <ToolCallPartUI key={part.toolCallId} part={part} />
    ))}
  </>
)
export const MessageArtifactsUI: FC<
  { imageParts: MessageToolCallPart[]; downloadParts: MessageToolCallPart[] } & ToolCallActionContext
> = ({ imageParts, downloadParts }) => <WebSearchGroupUI parts={[...imageParts, ...downloadParts]} />
