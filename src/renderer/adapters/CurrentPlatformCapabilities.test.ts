import { describe, expect, it, vi } from 'vitest'
import { CurrentPlatformCapabilities } from './CurrentPlatformCapabilities'
vi.mock('@/platform', () => ({ default: { type: 'desktop', isDesktopLike: true } }))
describe('chat-only platform capabilities', () => {
  it.each(['desktop', 'web', 'mobile'])('disables execution on %s', (type) => {
    expect(new CurrentPlatformCapabilities({ type, isDesktopLike: type === 'desktop' }).supports('agent-mode')).toBe(
      false
    )
  })
})
