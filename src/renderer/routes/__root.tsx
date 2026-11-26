import { currentBlobStorage } from '@/adapters/CurrentBlobStorage'
import { JK_PAGE_NAMES } from '@/analytics/jk-events'
import { trackPageView } from '@/analytics/page-view'
import { createPageViewVisitGate } from '@/analytics/page-view-visit-gate'
import { rendererApplication } from '@/app/renderer-application'
import { AppProviders } from '@/components/AppProviders'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import Toasts from '@/components/common/Toasts'
import DbSchemaGuardDialog from '@/components/DbSchemaGuardDialog'
import { AppTitleBar, useAppTitleBarHeight } from '@/components/layout/AppTitleBar'
import ExitFullscreenButton from '@/components/layout/ExitFullscreenButton'
import { BackupTaskOverlay } from '@/components/settings/BackupTaskOverlay'
import useAppTheme from '@/hooks/useAppTheme'
import { useSystemLanguageWhenInit } from '@/hooks/useDefaultSystemLanguage'
import { useI18nEffect } from '@/hooks/useI18nEffect'
import useNeedRoomForWinControls from '@/hooks/useNeedRoomForWinControls'
import useScreenChange, { useIsSmallScreen, useSidebarWidth } from '@/hooks/useScreenChange'
import useShortcut from '@/hooks/useShortcut'
import useVersion from '@/hooks/useVersion'
import { setChatWallpaperMarker } from '@/lib/glass-surface'
import '@/modals'
import SettingsModal from '@/modals/Settings'
import { navigateToSettings } from '@/modals/settings-navigation'
import { prefetchModelRegistry } from '@/packages/model-registry'
import { getOS } from '@/packages/navigator'
import { sessionStartupRecovery, useSessionStartupLoadTarget } from '@/packages/session-startup-recovery'
import PictureDialog from '@/pages/PictureDialog'
import { creteMantineTheme } from '@/theme/mantine-theme'
import NiceModal from '@ebay/nice-modal-react'
import {
  Button,
  type DefaultMantineColor,
  type MantineColorsTuple,
  MantineProvider,
  Text,
  useMantineColorScheme,
} from '@mantine/core'
import { Box, Grid } from '@mui/material'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { shouldNavigateToStartPage, shouldSkipOnboardingGuide, splitLaunchPath } from '@shared/dev-launch'
import { Theme } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { createRootRoute, Outlet, useLocation } from '@tanstack/react-router'
import clsx from 'clsx'
import { useSetAtom } from 'jotai'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import SearchDialog from '@/pages/SearchDialog'
import platform from '@/platform'
import { getSettingsSearchParam, navigateToDynamicPath } from '@/router'
import Sidebar from '@/Sidebar'
import * as atoms from '@/stores/atoms'
import { getRendererDevLaunchOptions } from '@/utils/dev-launch'

const useSessionHeader = (sessionId: string | null) => rendererApplication.sessionHooks.useSessionHeader(sessionId)

function getSessionIdFromPathname(pathname: string): string | null {
  if (!pathname.startsWith('/session/')) return null
  const sessionId = pathname.slice('/session/'.length)
  return sessionId && sessionId !== 'new' ? sessionId : null
}

import { initOnboardingStore, onboardingStore } from '@/stores/onboardingStore'

import { initSettingsStore, settingsStore, useLanguage, useSettingsStore, useTheme } from '@/stores/settingsStore'
import { add as addToast } from '@/stores/toastActions'
import { useUIStore } from '@/stores/uiStore'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'
function blobToDataUrl(blob: string): string {
  if (blob.startsWith('data:')) return blob
  return 'data:image/' + (blob.startsWith('/9j/') ? 'jpeg' : 'png') + ';base64,' + blob
}

/** The chat wallpaper's image URL on chat routes, or undefined until the image is actually available. */
function useChatWallpaperUrl(): string | undefined {
  const location = useLocation()
  const globalBackgroundImageKey = useSettingsStore((s) => s.backgroundImageKey)
  const isRootPage = location.pathname === '/'
  const isSessionPage = location.pathname.startsWith('/session/') && location.pathname.length > '/session/'.length
  const sessionId = getSessionIdFromPathname(location.pathname)
  const sessionLoadTarget = useSessionStartupLoadTarget(sessionId)
  const { session } = useSessionHeader(sessionLoadTarget)
  const effectiveKey =
    session?.backgroundImage?.type === 'storage-key'
      ? session?.backgroundImage?.storageKey
      : session?.backgroundImage?.type === 'url'
        ? undefined
        : globalBackgroundImageKey
  const { data: blob } = useQuery({
    queryKey: ['image-in-storage', effectiveKey],
    queryFn: async () => {
      if (!effectiveKey) return null
      const b = await currentBlobStorage.get(effectiveKey).catch(() => null)
      return b ?? null
    },
    enabled: !!effectiveKey,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const storedImageUrl = useMemo(() => (effectiveKey && blob ? blobToDataUrl(blob) : undefined), [effectiveKey, blob])

  if (!isRootPage && !isSessionPage) return undefined
  return session?.backgroundImage?.type === 'url' ? session.backgroundImage.url || undefined : storedImageUrl
}

function BackgroundImageOverlay({ imageUrl }: { imageUrl: string }) {
  const backgroundImageOpacity = useSettingsStore((s) => s.backgroundImageOpacity)
  const isSmallScreen = useIsSmallScreen()
  return (
    // Wide layouts render it inside the main panel, so the sidebar and title bar stay solid. Small
    // screens render it on the app shell, so it fills the safe areas and runs under the header.
    <div
      className={clsx(
        'pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat',
        isSmallScreen ? 'z-0' : '-z-10'
      )}
      style={{
        backgroundImage: `url("${imageUrl.replace(/"/g, '%22')}")`,
        opacity: backgroundImageOpacity,
      }}
    />
  )
}

function SettingsModalErrorFallback({ retry }: { error: Error; retry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[400] flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-solid border-chatbox-border-primary bg-chatbox-background-primary px-4 py-3 shadow-lg">
        <Text size="sm">{t('Settings failed to load')}</Text>
        <Button size="xs" variant="light" onClick={retry}>
          {t('Try Again')}
        </Button>
      </div>
    </div>
  )
}

function Root() {
  useScreenChange()
  const { t } = useTranslation()
  const startupTranslation = useRef(t)

  const { isExceeded, isExceededResolved } = useVersion()
  const location = useLocation()
  const startupPathname = useRef(location.pathname)
  const spellCheck = useSettingsStore((state) => state.spellCheck)
  const language = useLanguage()
  const wallpaperUrl = useChatWallpaperUrl()
  const hasBackgroundImage = Boolean(wallpaperUrl)
  useLayoutEffect(() => {
    setChatWallpaperMarker(document.documentElement, hasBackgroundImage)
  }, [hasBackgroundImage])
  const isSmallScreen = useIsSmallScreen()
  // The small-screen settings index sits on the grouped surface (see `SettingsRoot`).
  const pageSurface =
    isSmallScreen && (location.pathname === '/settings' || location.pathname === '/settings/') ? 'grouped' : undefined
  const pageViewSessionLoadTarget = useSessionStartupLoadTarget(getSessionIdFromPathname(location.pathname))
  const pageViewVisitGate = useRef(createPageViewVisitGate())
  const initialized = useRef(false)

  const setOpenAboutDialog = useUIStore((s) => s.setOpenAboutDialog)

  const setRemoteConfig = useSetAtom(atoms.remoteConfigAtom)

  useEffect(() => {
    if (initialized.current) {
      return
    }
    ;(async () => {
      // Wait for stores to hydrate from persistent storage
      await Promise.all([initSettingsStore(), initOnboardingStore()])
      void prefetchModelRegistry()

      onboardingStore.getState().markCompleted()
      initialized.current = true
      const launchOptions = getRendererDevLaunchOptions()
      if (
        launchOptions.startPage &&
        shouldNavigateToStartPage(
          launchOptions.startPage,
          location.pathname,
          location.search as Record<string, unknown>
        )
      ) {
        const { pathname, search } = splitLaunchPath(launchOptions.startPage)
        navigateToDynamicPath({ to: pathname, replace: true, search })
      }
    })()
  }, [location.pathname, location.search])

  const showSidebar = useUIStore((s) => s.showSidebar)
  const sidebarWidth = useSidebarWidth()
  const titleBarHeight = useAppTitleBarHeight()

  const _theme = useTheme()
  const { setColorScheme } = useMantineColorScheme()
  // biome-ignore lint/correctness/useExhaustiveDependencies: setColorScheme is stable
  useEffect(() => {
    if (_theme === Theme.Dark) {
      setColorScheme('dark')
    } else if (_theme === Theme.Light) {
      setColorScheme('light')
    } else {
      setColorScheme('auto')
    }
  }, [_theme])

  useEffect(() => {
    if (startupPathname.current !== '/') return
    if (shouldSkipOnboardingGuide(getRendererDevLaunchOptions())) {
      return
    }
    const { startupPage } = settingsStore.getState()
    let sid = ''
    try {
      sid = JSON.parse(localStorage.getItem('_currentSessionIdCachedAtom') || '""') as string
    } catch {
      sid = ''
    }
    if (sid && startupPage === 'session') {
      if (sessionStartupRecovery.shouldSkipAutoRestore(sid)) {
        addToast(startupTranslation.current('Last chat failed to open. Opened the chat list instead.'))
        return
      }
      navigateToDynamicPath({
        to: `/session/${sid}`,
        replace: true,
      })
    }
  }, [])

  useEffect(() => {
    if (platform.onNavigate) {
      // 移动端和其他平台的导航监听器
      return platform.onNavigate((path) => {
        // 如果是 settings 路径，使用 navigateToSettings 以保持与主页面设置按钮一致的行为
        // 在桌面端会打开 Modal，在移动端会正常导航
        if (path.startsWith('/settings')) {
          // 提取 settings 之后的路径部分（包含查询参数）
          const settingsPath = path.substring('/settings'.length)
          navigateToSettings(settingsPath || '/')
        } else {
          navigateToDynamicPath({ to: path })
        }
      })
    }
  }, [])

  // Page view tracking
  const settingsSearch = getSettingsSearchParam(location.search)
  useEffect(() => {
    const pathname = location.pathname
    const shouldTrackPageView = pageViewVisitGate.current.shouldTrack(pathname, settingsSearch)
    let pageName: string | undefined

    // 桌面端 settings 以 modal 方式打开，pathname 不变，通过 search.settings 控制
    if (settingsSearch) {
      pageName = JK_PAGE_NAMES.SETTING_PAGE
    } else if (pathname === '/' || pathname.startsWith('/session/')) {
      pageName = JK_PAGE_NAMES.CHAT_PAGE
    } else if (pathname.startsWith('/image-creator')) {
      pageName = JK_PAGE_NAMES.IMAGE_PAGE
    } else if (pathname.startsWith('/copilots')) {
      pageName = JK_PAGE_NAMES.COPILOTS_PAGE
    } else if (pathname.startsWith('/settings')) {
      pageName = JK_PAGE_NAMES.SETTING_PAGE
    } else if (pathname.startsWith('/guide')) {
      pageName = JK_PAGE_NAMES.HELP_PAGE
    } else if (pathname === '/about') {
      pageName = JK_PAGE_NAMES.ABOUT_PAGE
    }

    if (!pageName || !shouldTrackPageView) return

    void trackPageView(pageName, pageViewSessionLoadTarget ?? undefined)
  }, [location.pathname, pageViewSessionLoadTarget, settingsSearch])

  const { needRoomForMacWindowControls } = useNeedRoomForWinControls()
  useEffect(() => {
    if (needRoomForMacWindowControls) {
      document.documentElement.setAttribute('data-need-room-for-mac-controls', 'true')
    } else {
      document.documentElement.removeAttribute('data-need-room-for-mac-controls')
    }
  }, [needRoomForMacWindowControls])

  return (
    <Box
      className={clsx(
        'box-border App relative flex flex-col',
        titleBarHeight ? 'bg-chatbox-background-primary-hover' : 'bg-chatbox-background-primary'
      )}
      data-chatbox-platform={CHATBOX_BUILD_PLATFORM}
      data-page-surface={pageSurface}
      spellCheck={spellCheck}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {platform.isDesktopLike && (getOS() === 'Windows' || getOS() === 'Linux') && <ExitFullscreenButton />}
      {isSmallScreen && wallpaperUrl && <BackgroundImageOverlay imageUrl={wallpaperUrl} />}
      <AppTitleBar />
      <Grid container className="chatbox-app-content min-h-0 flex-1 relative z-[1]">
        <Sidebar />
        <Box
          className="relative h-full w-full box-border"
          sx={{
            flexGrow: 1,
            transition: (theme) =>
              theme.transitions.create('padding', {
                easing: showSidebar ? theme.transitions.easing.easeOut : theme.transitions.easing.sharp,
                duration: showSidebar
                  ? theme.transitions.duration.enteringScreen
                  : theme.transitions.duration.leavingScreen,
              }),
            ...(showSidebar
              ? language === 'ar'
                ? { paddingRight: { sm: `${sidebarWidth}px` } }
                : { paddingLeft: { sm: `${sidebarWidth}px` } }
              : {}),
          }}
        >
          {/* Wide layouts: the content panel sits flush under the title bar and meets the sidebar with one rounded corner. */}
          <Box
            className={clsx(
              'h-full overflow-hidden box-border border-0 border-solid border-chatbox-border-primary',
              hasBackgroundImage ? 'relative isolate bg-transparent' : 'bg-chatbox-background-primary'
            )}
            data-page-surface={pageSurface}
            sx={
              titleBarHeight
                ? {
                    borderTopWidth: '1px',
                    borderInlineStartWidth: showSidebar ? '1px' : 0,
                    borderStartStartRadius: showSidebar ? '16px' : 0,
                  }
                : undefined
            }
          >
            {!isSmallScreen && wallpaperUrl && <BackgroundImageOverlay imageUrl={wallpaperUrl} />}
            {/* Keyed per route so a crashing page stays contained to that page
                instead of latching the whole main area until the app restarts. */}
            <ErrorBoundary key={location.pathname} name="main">
              <Outlet />
            </ErrorBoundary>
          </Box>
        </Box>
      </Grid>
      {/* 对话设置 */}
      {/* <AppStoreRatingDialog /> */}
      {/* 代码预览 */}
      {/* <ArtifactDialog /> */}
      {/* 对话列表清理 */}
      {/* <ChatConfigWindow /> */}
      {/* 似乎未使用 */}
      {/* <CleanWidnow /> */}
      {/* 对话列表清理 */}
      {/* <ClearConversationListWindow /> */}
      {/* 导出聊天记录 */}
      {/* <ExportChatDialog /> */}
      {/* 编辑消息 */}
      {/* <MessageEditDialog /> */}
      {/* 添加链接 */}
      {/* <OpenAttachLinkDialog /> */}
      {/* 图片预览 */}
      <PictureDialog />
      {/* 似乎是从后端拉一个弹窗的配置 */}
      {/* 一次性客户端通知，与现有远程弹窗和更新提示保持独立 */}
      {/* IndexedDB schema 与当前版本不匹配时的升级/刷新引导 */}
      <DbSchemaGuardDialog />
      <BackupTaskOverlay />
      {/* 手机端举报内容 */}
      {/* <ReportContentDialog /> */}
      {/* 搜索 */}
      <SearchDialog />
      {/* 没有配置模型时的欢迎弹窗 */}
      {/* <WelcomeDialog /> */}
      <Toasts /> {/* mui */}
      <ErrorBoundary name="settings-modal" fallback={SettingsModalErrorFallback}>
        <SettingsModal />
      </ErrorBoundary>
    </Box>
  )
}

export const Route = createRootRoute({
  component: () => {
    useI18nEffect()

    useSystemLanguageWhenInit()
    useShortcut()
    const theme = useAppTheme()
    const _theme = useTheme()
    const fontSize = useSettingsStore((state) => state.fontSize)
    useEffect(() => {
      document.documentElement.style.setProperty('--chatbox-msg-font-size', `${fontSize}px`)
    }, [fontSize])
    const mantineTheme = useMemo(() => creteMantineTheme(), [])

    return (
      <MantineProvider
        theme={mantineTheme}
        defaultColorScheme={_theme === Theme.Dark ? 'dark' : _theme === Theme.Light ? 'light' : 'auto'}
      >
        <AppProviders>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <NiceModal.Provider>
              <ErrorBoundary>
                <Root />
              </ErrorBoundary>
            </NiceModal.Provider>
          </ThemeProvider>
        </AppProviders>
      </MantineProvider>
    )
  },
})

type ExtendedCustomColors =
  | 'chatbox-brand'
  | 'chatbox-gray'
  | 'chatbox-success'
  | 'chatbox-error'
  | 'chatbox-warning'
  | 'chatbox-primary'
  | 'chatbox-secondary'
  | 'chatbox-tertiary'
  | DefaultMantineColor

declare module '@mantine/core' {
  export interface MantineThemeColorsOverride {
    colors: Record<ExtendedCustomColors, MantineColorsTuple>
  }
}
