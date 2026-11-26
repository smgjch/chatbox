import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function readMainSource(filename: string): string {
  return readFileSync(fileURLToPath(new URL(filename, import.meta.url)), 'utf8')
}

describe('QA preflight entrypoint ordering', () => {
  it('loads before modules that can touch the Electron userData profile', () => {
    const mainSource = readMainSource('./main.ts')
    const preflightImportIndex = mainSource.indexOf("from './qa-preflight'")
    const storeImportIndex = mainSource.indexOf("from './store-node'")

    expect(preflightImportIndex).toBeGreaterThan(-1)
    expect(storeImportIndex).toBeGreaterThan(-1)
    expect(preflightImportIndex).toBeLessThan(storeImportIndex)
  })

  it('does not initialize Electron while validating launch arguments', () => {
    const preflightSource = readMainSource('./qa-preflight.ts')

    expect(preflightSource).not.toMatch(/from ['"]electron['"]|require\(['"]electron['"]\)/)
  })
})
