import type { FileEditRequest, FileEditResult } from '@shared/file-edits'
/** biome-ignore-all lint/suspicious/noExplicitAny: <any> */

import { parseLocale } from '@/i18n/parser'
import { getLogger } from '@/lib/utils'
import { type ImageGenerationStorage, IndexedDBImageGenerationStorage } from '@/storage/ImageGenerationStorage'
import { IndexedDBSessionMetaStorage, type SessionMetaStorage } from '@/storage/SessionMetaStorage'
import { IndexedDBSessionRowStore } from '@/storage/SessionRowStorage'
import { rememberFileNativePath } from '@/utils/file-native-path'
import type { SessionRowStorePort } from '@chatbox/core/ports'
import type { AnalyticsEventParams } from '@shared/analytics'
import type { ElectronIPC } from '@shared/electron-types'
import type { Config, Settings, ShortcutSetting } from '@shared/types'
import type { WorkspaceInstructionsResult } from '@shared/types/workspace-instructions'
import { cache } from '@shared/utils/cache'
import localforage from 'localforage'
import { v4 as uuidv4 } from 'uuid'
import { getOS } from '../packages/navigator'
import { DesktopBuiltInBrowser } from './desktop-built-in-browser'
import { desktopResourceFiles } from './desktop-resource-files'
import DesktopExporter from './desktop_exporter'
import type { Exporter, Platform, PlatformType } from './interfaces'

import { parseTextFileLocally } from './web_platform_utils'

const log = getLogger('desktop-platform')

const store = localforage.createInstance({ name: 'chatboxstore' })

export default class DesktopPlatform implements Platform {
  public type: PlatformType = 'desktop'
  public readonly isDesktopLike = true

  public exporter: Exporter
  public resourceFiles: ReturnType<typeof desktopResourceFiles>
  public builtInBrowser?: DesktopBuiltInBrowser

  private _imageGenerationStorage: ImageGenerationStorage | null = null
  private _sessionMetaStorage: SessionMetaStorage | null = null
  private _sessionRowStore: SessionRowStorePort | null = null

  public ipc: ElectronIPC
  constructor(ipc: ElectronIPC) {
    this.ipc = ipc
    this.exporter = new DesktopExporter(ipc)
    this.resourceFiles = desktopResourceFiles(ipc)
  }

  public getStorageType(): string {
    return 'INDEXEDDB'
  }

  public async getVersion() {
    return cache('ipc:getVersion', () => this.ipc.invoke('getVersion'), { ttl: 5 * 60 * 1000, memoryOnly: true })
  }
  public async getPlatform() {
    return cache('ipc:getPlatform', () => this.ipc.invoke('getPlatform'), { ttl: 5 * 60 * 1000 })
  }
  public async getArch() {
    return cache('ipc:getArch', () => this.ipc.invoke('getArch'), { ttl: 5 * 60 * 1000 })
  }
  public async shouldUseDarkColors(): Promise<boolean> {
    return await this.ipc.invoke('shouldUseDarkColors')
  }
  public onSystemThemeChange(callback: () => void): () => void {
    return this.ipc.onSystemThemeChange(callback)
  }
  public onWindowShow(callback: () => void): () => void {
    return this.ipc.onWindowShow(callback)
  }
  public onWindowFocused(callback: () => void): () => void {
    return this.ipc.onWindowFocused(callback)
  }
  public async isWindowFocused(): Promise<boolean> {
    return this.ipc.invoke('window:is-focused')
  }
  public onUpdateDownloaded(callback: () => void): () => void {
    return this.ipc.onUpdateDownloaded(callback)
  }
  public onUpdaterChecking(callback: () => void): () => void {
    return this.ipc.onUpdaterChecking(callback)
  }
  public onUpdaterAvailable(callback: (data: { version: string }) => void): () => void {
    return this.ipc.onUpdaterAvailable(callback)
  }
  public onUpdaterNotAvailable(callback: () => void): () => void {
    return this.ipc.onUpdaterNotAvailable(callback)
  }
  public onUpdaterProgress(
    callback: (data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void
  ): () => void {
    return this.ipc.onUpdaterProgress(callback)
  }
  public onUpdaterDownloaded(callback: (data: { version: string }) => void): () => void {
    return this.ipc.onUpdaterDownloaded(callback)
  }
  public onUpdaterError(callback: (data: { message: string }) => void): () => void {
    return this.ipc.onUpdaterError(callback)
  }
  public async checkForUpdate(): Promise<{ started: boolean }> {
    return this.ipc.invoke('updater:check')
  }
  public onNavigate(callback: (path: string) => void): () => void {
    return window.electronAPI.onNavigate(callback)
  }
  public async openLink(url: string): Promise<void> {
    return this.ipc.invoke('openLink', url)
  }
  public async getDeviceName(): Promise<string> {
    const deviceName = await cache('ipc:getDeviceName', () => this.ipc.invoke('getDeviceName'), {
      ttl: 5 * 60 * 1000,
    })
    return deviceName
  }
  public async getInstanceName(): Promise<string> {
    const deviceName = await this.getDeviceName()
    return `${deviceName} / ${getOS()}`
  }
  public async getLocale() {
    const locale = await cache('ipc:getLocale', () => this.ipc.invoke('getLocale'), { ttl: 5 * 60 * 1000 })
    return parseLocale(locale)
  }
  public async ensureShortcutConfig(config: ShortcutSetting): Promise<void> {
    return this.ipc.invoke('ensureShortcutConfig', JSON.stringify(config))
  }
  public async ensureProxyConfig(config: { proxy?: string }): Promise<void> {
    return this.ipc.invoke('ensureProxy', JSON.stringify(config))
  }
  public async relaunch(): Promise<void> {
    return this.ipc.invoke('relaunch')
  }

  public async getConfig(): Promise<Config> {
    return this.ipc.invoke('getConfig')
  }
  public async getSettings(): Promise<Settings> {
    return this.ipc.invoke('getSettings')
  }

  private needStoreInFile(key: string): boolean {
    return key === 'configs' || key === 'settings' || key === 'configVersion'
  }

  public async setStoreValue(key: string, value: any) {
    // 为什么序列化成 JSON？
    // 因为 IndexedDB 作为底层驱动时，可以直接存储对象，但是如果对象中包含函数或引用，将会直接报错
    let valueJson: string
    try {
      valueJson = JSON.stringify(value)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to serialize value for key "${key}": ${message}`)
    }
    if (this.needStoreInFile(key)) {
      return this.ipc.invoke('setStoreValue', key, valueJson)
    } else {
      await store.setItem(key, valueJson)
    }
  }
  public async getStoreValue(key: string) {
    if (this.needStoreInFile(key)) {
      return this.ipc.invoke('getStoreValue', key)
    } else {
      const json = await store.getItem<string>(key)
      if (!json) return null
      try {
        return JSON.parse(json)
      } catch (error) {
        console.error(`Failed to parse stored value for key "${key}":`, error)
        return null
      }
    }
  }
  public async delStoreValue(key: string) {
    if (this.needStoreInFile(key)) {
      return this.ipc.invoke('delStoreValue', key)
    } else {
      return await store.removeItem(key)
    }
  }
  public async getAllStoreValues(): Promise<{ [key: string]: any }> {
    const ret: { [key: string]: any } = {}
    await store.iterate((json, key) => {
      const value = typeof json === 'string' ? JSON.parse(json) : null
      ret[key] = value
    })
    const json = JSON.parse(await this.ipc.invoke('getAllStoreValues'))
    for (const [key, value] of Object.entries(json)) {
      if (this.needStoreInFile(key)) {
        ret[key] = value
      }
    }
    return ret
  }
  public async getAllStoreKeys(): Promise<string[]> {
    const keys = await store.keys()
    const ipcKeys: string[] = await this.ipc.invoke('getAllStoreKeys')
    return [...keys, ...ipcKeys]
  }
  public async setAllStoreValues(data: { [key: string]: any }): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      await this.setStoreValue(key, value)
    }
  }

  public async getStoreBlob(key: string): Promise<string | null> {
    return this.ipc.invoke('getStoreBlob', key)
  }
  public async setStoreBlob(key: string, value: string) {
    return this.ipc.invoke('setStoreBlob', key, value)
  }
  public async delStoreBlob(key: string) {
    return this.ipc.invoke('delStoreBlob', key)
  }
  public async listStoreBlobKeys(): Promise<string[]> {
    return this.ipc.invoke('listStoreBlobKeys')
  }

  public initTracking(): void {
    // Desktop events are sent through the main-process Measurement Protocol bridge.
  }
  public async trackingEvent(name: string, params: AnalyticsEventParams): Promise<void> {
    const chatboxPlatform = await this.getPlatform()
    const dataJson = JSON.stringify({
      name,
      params: {
        ...params,
        chatbox_platform_type: 'desktop',
        chatbox_platform: chatboxPlatform,
      },
    })
    await this.ipc.invoke('analysticTrackingEvent', dataJson)
  }

  public async shouldShowAboutDialogWhenStartUp(): Promise<boolean> {
    return cache('ipc:shouldShowAboutDialogWhenStartUp', () => this.ipc.invoke('shouldShowAboutDialogWhenStartUp'), {
      ttl: 30 * 1000,
    })
  }

  public async appLog(level: string, message: string) {
    return this.ipc.invoke('appLog', JSON.stringify({ level, message }))
  }

  public async exportLogs(): Promise<string> {
    return this.ipc.invoke('exportLogs')
  }

  public async clearLogs(): Promise<void> {
    return this.ipc.invoke('clearLogs')
  }

  public async ensureAutoLaunch(enable: boolean) {
    return this.ipc.invoke('ensureAutoLaunch', enable)
  }

  async parseFileLocally(file: File): Promise<{ key?: string; isSupported: boolean; errorCode?: string }> {
    let result: { text: string; isSupported: boolean; errorCode?: string }
    const filePath = this.getLocalFilePath(file)
    if (!filePath) {
      // 复制长文本粘贴的文件是没有 path 的
      result = await parseTextFileLocally(file)
    } else {
      const resultJSON = await this.ipc.invoke('parseFileLocally', JSON.stringify({ filePath }))
      result = JSON.parse(resultJSON)
    }
    if (!result.isSupported) {
      log.error(
        `parseFileLocally: unsupported file "${file.name}" (path=${filePath || 'none'}, errorCode=${result.errorCode || 'none'})`
      )
      return { isSupported: false, errorCode: result.errorCode }
    }
    const key = `parseFile-` + uuidv4()
    await this.setStoreBlob(key, result.text)
    return { key, isSupported: true }
  }

  getLocalFilePath(file: File): string {
    return rememberFileNativePath(file, this.ipc.getPathForFile(file))
  }

  async readLocalFileContent(filePath: string): Promise<string | null> {
    const resultJSON = await this.ipc.invoke('parseFileLocally', JSON.stringify({ filePath }))
    const result = JSON.parse(resultJSON)
    if (!result.isSupported) {
      return null
    }
    return result.text || null
  }

  async fsRead(params: { filePath: string; offset?: number; limit?: number }) {
    return this.ipc.invoke('fs:read', params)
  }

  async fsReadImage(params: { filePath: string }): Promise<{ success: boolean; bytes?: ArrayBuffer; error?: string }> {
    return this.ipc.invoke('fs:read-image', params)
  }

  async readWorkspaceInstructions(directories: string[]): Promise<WorkspaceInstructionsResult> {
    return this.ipc.invoke('workspace:read-instructions', directories)
  }

  async fsList(params: { dirPath: string }) {
    return this.ipc.invoke('fs:list', params)
  }

  async fsSearch(params: { pattern: string; dirPath: string; regex?: boolean; include?: string }) {
    return this.ipc.invoke('fs:search', params)
  }

  async fsWrite(params: { filePath: string; content: string }) {
    return this.ipc.invoke('fs:write', params)
  }

  async fsEdit(params: FileEditRequest): Promise<FileEditResult> {
    return this.ipc.invoke('fs:edit', params)
  }

  async parseFileWithMineru(
    file: File,
    apiToken: string
  ): Promise<{ success: boolean; content?: string; error?: string; cancelled?: boolean }> {
    const filePath = this.getLocalFilePath(file)
    if (!filePath) {
      // Files without path (e.g., pasted files) are not supported for MinerU parsing
      return { success: false, error: 'File path is required for MinerU parsing' }
    }

    return this.ipc.invoke('parser:parse-file-with-mineru', {
      filePath,
      filename: file.name,
      mimeType: file.type,
      apiToken,
    })
  }

  async cancelMineruParse(filePath: string): Promise<{ success: boolean; error?: string }> {
    return this.ipc.invoke('parser:cancel-mineru-parse', filePath)
  }

  public async parseUrl(url: string): Promise<{ key: string; title: string }> {
    const json = await this.ipc.invoke('parseUrl', url)
    return JSON.parse(json)
  }

  public async isFullscreen() {
    return this.ipc.invoke('isFullscreen')
  }

  public async setFullscreen(enabled: boolean) {
    return this.ipc.invoke('setFullscreen', enabled)
  }

  public async installUpdate() {
    return this.ipc.invoke('install-update')
  }

  public async switchTheme(theme: 'dark' | 'light') {
    return this.ipc.invoke('switch-theme', theme)
  }

  public getImageGenerationStorage(): ImageGenerationStorage {
    if (!this._imageGenerationStorage) {
      this._imageGenerationStorage = new IndexedDBImageGenerationStorage()
    }
    return this._imageGenerationStorage
  }

  public getSessionMetaStorage(): SessionMetaStorage {
    if (!this._sessionMetaStorage) {
      this._sessionMetaStorage = new IndexedDBSessionMetaStorage()
    }
    return this._sessionMetaStorage
  }

  public getSessionRowStore(): SessionRowStorePort {
    if (!this._sessionRowStore) {
      this._sessionRowStore = new IndexedDBSessionRowStore()
    }
    return this._sessionRowStore
  }

  public async openDirectoryDialog() {
    return this.ipc.invoke('dialog:openDirectory')
  }

  public minimize() {
    return this.ipc.invoke('window:minimize')
  }

  public maximize() {
    return this.ipc.invoke('window:maximize')
  }

  public unmaximize() {
    return this.ipc.invoke('window:unmaximize')
  }

  public setTaskCloseProtection(active: boolean): Promise<void> {
    return this.ipc.invoke('task-operation:set-active', active)
  }

  public onTaskCloseRequest(callback: () => void): () => void {
    return this.ipc.onTaskCloseRequest(callback)
  }

  public finishTaskClose(confirmed: boolean): Promise<void> {
    return this.ipc.invoke('task-operation:finish-close', confirmed)
  }

  public closeWindow() {
    return this.ipc.invoke('window:close')
  }

  public isMaximized() {
    return this.ipc.invoke('window:is-maximized')
  }

  public onMaximizedChange(callback: (isMaximized: boolean) => void): () => void {
    const unsubscribe = this.ipc.onWindowMaximizedChanged((_, isMaximized) => {
      callback(isMaximized)
    })

    return unsubscribe
  }
}
