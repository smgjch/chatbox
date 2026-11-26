// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

vi.mock('@/hooks/useScreenChange', () => ({ useIsSmallScreen: () => false }))
vi.mock('@/analytics/model-selection', () => ({ trackListModelClick: vi.fn(), trackSelectModelClick: vi.fn() }))
vi.mock('@/hooks/useProviders', () => ({
  useProviders: () => ({
    providers: [
      {
        id: 'custom-gemini',
        name: 'Proxy Gemini',
        isCustom: true,
        models: [{ modelId: 'gemini-4-argon', type: 'chat' }],
      },
    ],
    favoritedModels: [],
    favoriteModel: vi.fn(),
    unfavoriteModel: vi.fn(),
    isFavoritedModel: () => false,
  }),
}))
vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (select: (state: unknown) => unknown) => select({ favoritedModels: [] }),
}))
vi.mock('@/stores/uiStore', () => ({
  useUIStore: (select: (state: unknown) => unknown) =>
    select({ modelSelectorTab: 'all', setModelSelectorTab: vi.fn() }),
}))
vi.mock('@/stores/atoms/uiAtoms', async () => ({ collapsedProvidersAtom: (await import('jotai')).atom({}) }))
vi.mock('../icons/ModelIcon', () => ({ ModelIcon: () => null }))
vi.mock('../icons/ProviderIcon', () => ({ default: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }))

import { ModelSelectorV2 } from './index'

beforeEach(() => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  Element.prototype.scrollIntoView = vi.fn()
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(cleanup)

test('the full selector renders custom provider models and selects the requested model', async () => {
  const onSelect = vi.fn()
  render(
    <MantineProvider>
      <ModelSelectorV2 onSelect={onSelect}>
        <button type="button">Choose model</button>
      </ModelSelectorV2>
    </MantineProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Choose model' }))
  const panel = await screen.findByTestId('model-selector-panel')
  fireEvent.click(within(panel).getByText('gemini-4-argon'))
  expect(onSelect).toHaveBeenCalledWith('custom-gemini', 'gemini-4-argon')
  expect(within(panel).queryByText('Chatbox AI')).toBeNull()
})
