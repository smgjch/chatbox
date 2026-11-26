import type { Settings } from './types'

/** Applies to hydration and imports as well as edits: old backups cannot re-enable removed services. */
export function chatOnlySettings(settings: Settings): Settings {
  const { ['chatbox-ai']: _accountProvider, ...providers } = settings.providers ?? {}
  const result: Settings = {
    ...settings,
    providers: settings.providers && !settings.providers['chatbox-ai'] ? settings.providers : providers,
    customProviders: settings.customProviders?.filter((p) => p.id !== 'chatbox-ai' && p.type !== 'chatbox-ai'),
    defaultChatModel: settings.defaultChatModel?.provider === 'chatbox-ai' ? undefined : settings.defaultChatModel,
    threadNamingModel: settings.threadNamingModel?.provider === 'chatbox-ai' ? undefined : settings.threadNamingModel,
    ocrModel: settings.ocrModel?.provider === 'chatbox-ai' ? undefined : settings.ocrModel,
    searchTermConstructionModel: undefined,
    defaultEmbeddingModel: undefined,
    defaultRerankModel: undefined,
    licenseKey: undefined,
    licenseDetail: undefined,
    licenseInstances: undefined,
    licensePlanName: undefined,
    licenseActivationMethod: undefined,
    memorizedManualLicenseKey: undefined,
    lastSelectedLicenseByUser: undefined,
    hasExpiredLicense: false,
    vibedropPublishKey: undefined,
    vibedropSlugs: undefined,
    vibedropSessionPublications: undefined,
    memoryEnabled: false,
    autoUpdate: false,
    betaUpdate: false,
    pauseOnToolCallLimit: false,
    allowReportingAndTracking: false,
    mcp: { servers: [], enabledBuiltinServers: [] },
    skills: {
      enabledSkillNames: [],
      translationEnabled: false,
      builtinDefaultsInitialized: true,
      appliedDefaultBuiltinSkillNames: [],
    },
    extension: {
      ...settings.extension,
      documentParser: { type: 'local' },
      knowledgeBase: { models: {} },
    },
  }
  for (const key of [
    'licenseKey',
    'licenseDetail',
    'licenseInstances',
    'licensePlanName',
    'licenseActivationMethod',
    'memorizedManualLicenseKey',
    'lastSelectedLicenseByUser',
    'vibedropPublishKey',
    'vibedropSlugs',
    'vibedropSessionPublications',
  ] as const)
    delete result[key]
  if (!settings.providers) delete result.providers
  return result
}
