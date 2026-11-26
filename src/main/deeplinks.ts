import type { BrowserWindow } from 'electron'
/** Only provider configuration imports are supported in the chat-only client. */
export function handleDeepLink(mainWindow: BrowserWindow, link: string) {
  const url = new URL(link)
  if (!['chatbox-lite:', 'chatbox-lite-dev:'].includes(url.protocol)) return
  if (url.hostname === 'provider' && url.pathname === '/import') {
    const config = url.searchParams.get('config') || ''
    mainWindow.webContents.send('navigate-to', '/settings/provider?import=' + encodeURIComponent(config))
  }
}
