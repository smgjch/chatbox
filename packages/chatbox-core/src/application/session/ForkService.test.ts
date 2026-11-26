import { describe, expect, test } from 'vitest'
import type { Message, Session } from '../../types'
import { rowChatFixture } from '../chat/testing/row-chat-fixture'
import { ForkService } from './ForkService'

function message(id: string, role: Message['role']): Message {
  return { id, role, contentParts: [{ type: 'text', text: id }] }
}

describe('ForkService', () => {
  test('applies the shared fork transform through one atomic row command', async () => {
    let session: Session = {
      id: 'session-1',
      name: 'Forks',
      messages: [message('pivot', 'user'), message('tail', 'assistant')],
    }
    let id = 0
    const service = new ForkService(
      {
        async executeStructureCommand(id, operation, onCommitted) {
          const fixture = rowChatFixture(() => 'unused', session)
          const result = await fixture.port.executeStructureCommand(id, operation, onCommitted)
          session = fixture.sessions.get(id)!
          return result
        },
      },
      { createId: () => `id-${++id}`, now: () => 1 }
    )

    await service.create(session.id, 'pivot')

    expect(session.messages.map(({ id }) => id)).toEqual(['pivot'])
    expect(session.messageForksHash?.pivot?.lists).toHaveLength(2)
    expect(session.messageForksHash?.pivot?.lists[0].messages.map(({ id }) => id)).toEqual(['tail'])
  })

  test('keeps the current Session unchanged when a transform has no target', async () => {
    const original: Session = { id: 'session-1', name: 'Forks', messages: [message('only', 'user')] }
    let session = original
    const service = new ForkService(
      {
        async executeStructureCommand(id, operation, onCommitted) {
          const fixture = rowChatFixture(() => 'unused', session)
          const result = await fixture.port.executeStructureCommand(id, operation, onCommitted)
          session = fixture.sessions.get(id)!
          return result
        },
      },
      { createId: () => 'unused', now: () => 1 }
    )

    await service.create(session.id, 'missing')

    expect(session).toEqual(original)
  })
})
