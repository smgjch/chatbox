import { parsePdfFileLocally } from '@/packages/pdf-parser'
import { isPdfFilePath, isTextFilePath } from '@shared/file-extensions'

export async function parseTextFileLocally(file: File): Promise<{ text: string; isSupported: boolean }> {
  if (!isTextFilePath(file.name)) {
    // 只在桌面端有 attachment.path，网页版本只有 attachment.name
    return { text: '', isSupported: false }
  }
  const text = await file.text()
  return { text, isSupported: true }
}

export async function parseFileLocallyInBrowser(
  file: File
): Promise<{ text: string; isSupported: boolean; errorCode?: string }> {
  if (isTextFilePath(file.name)) {
    return parseTextFileLocally(file)
  }

  if (!isPdfFilePath(file.name)) {
    return { text: '', isSupported: false }
  }

  try {
    return { text: await parsePdfFileLocally(file), isSupported: true }
  } catch (error) {
    return { text: '', isSupported: false, errorCode: error instanceof Error ? error.message : undefined }
  }
}

export async function parseUrlContentFree(_url: string): Promise<{ key: string; title: string }> {
  throw new Error('URL attachments require the desktop app. You can paste the link into your message.')
}
