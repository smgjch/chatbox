// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import type { Message } from '@shared/types'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { GeminiThinkingSummary, getGeminiThinkingSummary } from './GeminiThinkingSummary'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { tokens: number }) => key.replace('{{tokens}}', String(values?.tokens)),
  }),
}))
beforeAll(() => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
})
afterEach(cleanup)
const reply = (fields: Partial<Message> = {}): Message => ({
  id: 'reply',
  role: 'assistant',
  modelId: 'private-alias',
  reasoningSummaryRequested: true,
  contentParts: [{ type: 'text', text: 'Answer' }],
  finishReason: 'stop',
  ...fields,
})
function show(message: Message, copy = vi.fn().mockReturnValue(vi.fn())) {
  return render(
    <MantineProvider>
      <GeminiThinkingSummary message={message} onCopy={copy} />
    </MantineProvider>
  )
}
describe('native Gemini thinking summaries', () => {
  it('shows and copies only native summary text, separately from the answer', () => {
    const copied = vi.fn()
    const copy = vi.fn().mockReturnValue(copied)
    show(
      reply({
        contentParts: [
          { type: 'reasoning', text: 'Check each case.' },
          { type: 'text', text: 'Answer' },
        ],
        usage: { reasoningTokens: 23 },
      }),
      copy
    )
    const button = screen.getByRole('button', { name: 'Thinking summary' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Check each case.')).toBeTruthy()
    expect(screen.getByText('Reasoning tokens: 23')).toBeTruthy()
    expect(screen.queryByText('Answer')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Copy reasoning content' }))
    expect(copy).toHaveBeenCalledWith('Check each case.')
    expect(copied).toHaveBeenCalledOnce()
  })
  it('shows missing summary and reported usage without inventing a summary', () => {
    show(reply({ usage: { reasoningTokens: 23 } }))
    expect(screen.getByText('The server did not provide a thinking summary.')).toBeTruthy()
    expect(screen.getByText('Reasoning tokens: 23')).toBeTruthy()
    expect(screen.queryByText('Reasoning usage was not provided.')).toBeNull()
  })
  it('keeps unreported usage distinct from a reported zero', () => {
    expect(getGeminiThinkingSummary(reply())).toEqual({ summary: '', tokens: undefined })
    expect(getGeminiThinkingSummary(reply({ usage: { reasoningTokens: 0 } }))).toEqual({ summary: '', tokens: 0 })
    show(reply())
    expect(screen.getByText('Reasoning usage was not provided.')).toBeTruthy()
    expect(screen.queryByText('Reasoning tokens: 0')).toBeNull()
  })
  it('does not claim a missing summary while the response is pending', () => {
    show(reply({ generating: true }))
    expect(screen.getByText('Waiting for a server thinking summary…')).toBeTruthy()
    expect(screen.queryByText('The server did not provide a thinking summary.')).toBeNull()
    expect(screen.queryByText('Reasoning usage was not provided.')).toBeNull()
  })
  it('handles legacy Gemini messages without treating synthetic zero usage as a report', () => {
    expect(
      getGeminiThinkingSummary(
        reply({ modelId: 'gemini-4-argon', reasoningSummaryRequested: undefined, usage: { reasoningTokens: 0 } })
      )
    ).toEqual({ summary: '', tokens: undefined })
  })
  it('omits unrelated, disabled, failed and canceled messages', () => {
    for (const message of [
      reply({ role: 'user' }),
      reply({ reasoningSummaryRequested: undefined, modelId: 'gpt-6' }),
      reply({ reasoningSummaryRequested: false }),
      reply({ error: 'Network error' }),
      reply({ finishReason: 'canceled' }),
    ]) {
      expect(getGeminiThinkingSummary(message)).toBeNull()
    }
  })
})
