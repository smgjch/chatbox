import { describe, expect, it } from 'vitest'
import type { Message } from '../types'
import { analyzeAttachmentTokens, IMAGE_TOKEN_ESTIMATE } from './attachments'

const file = {
  id: 'file',
  name: 'book.pdf',
  fileType: 'application/pdf',
  storageKey: 'book',
  lineCount: 10000,
  byteLength: 500000,
  tokenCountMap: { default: 100000 },
}
describe('shared attachment costs', () => {
  it('counts image input separately and marks it approximate', () => {
    const message: Message = { id: 'image', role: 'user', contentParts: [{ type: 'image', storageKey: 'image:1' }] }
    expect(analyzeAttachmentTokens(message, 'default')).toEqual({
      tokens: IMAGE_TOKEN_ESTIMATE,
      missing: [],
      approximate: true,
    })
  })
})
