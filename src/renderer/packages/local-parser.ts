import platform from '@/platform'
import { v4 as uuidv4 } from 'uuid'

export async function parseTextFile(file: File, options: { maxLength?: number } = {}) {
  let text = await file.text()
  if (options.maxLength) {
    text = text.trim().slice(0, options.maxLength)
  }
  const key = `parseFile-` + uuidv4()
  await platform.setStoreBlob(key, text)
  return { key }
}

export async function parseUrl(url: string) {
  if (!platform.parseUrl) throw new Error('URL attachments are not supported on this platform')
  return platform.parseUrl(url)
}
