/** Public React bindings for host-owned Chatbox application instances. */

export {
  ChatboxApplicationContext,
  useChatboxApplication,
  type ChatboxReactApplication,
} from './application-context'
export { useChatboxAuthInfo, useChatboxLastUsedModel, useChatboxSettings } from './application-hooks'
export { ChatboxProvider, type ChatboxProviderProps } from './ChatboxProvider'

export {
  createChatApplication,
  type ChatApplication,
  type CreateChatApplicationOptions,
} from './createChatApplication'
export { createGenerationHooks } from './generation-hooks'

export {
  ApplicationQueryBridge,
  QueryKeys,
  SessionQueryBridge,
  bindReactQueryHostLifecycle,
  createChatQueryClient,
  createSessionHooks,
  createSessionQueryDefinitions,
  type HostBooleanStateSource,
  type InfiniteSessionData,
  type ReactQueryHostLifecycle,
  type SessionQueryDefinitions,
  type SessionQuerySource,
} from './query'
export {
  AUTH_INFO_PERSIST_KEY,
  AUTH_INFO_PERSIST_VERSION,
  LAST_USED_MODEL_PERSIST_KEY,
  LAST_USED_MODEL_PERSIST_VERSION,
  createAuthInfoStore,
  createLastUsedModelStore,
  createSettingsStore,
  selectLanguage,
  selectMcpSettings,
  selectSettings,
  selectSettingsHydrationStatus,
  selectTheme,
  useAuthInfoStore,
  useLastUsedModelStore,
  useSettingsStore,
  type AuthInfoActions,
  type AuthInfoPersistedState,
  type AuthInfoState,
  type AuthInfoStore,
  type AuthInfoStoreState,
  type AuthTokens,
  type CreateAuthInfoStoreOptions,
  type CreateLastUsedModelStoreOptions,
  type LastUsedModel,
  type LastUsedModelActions,
  type LastUsedModelState,
  type LastUsedModelStore,
  type LastUsedModelStoreState,
  type SettingsActionUpdate,
  type SettingsHydrationStatus,
  type SettingsStore,
  type SettingsStoreActions,
  type SettingsStoreMetadata,
  type SettingsStoreSetStateUpdate,
  type SettingsStoreState,
} from './stores'
