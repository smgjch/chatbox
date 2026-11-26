import platform from '@/platform'
import { diagnosticSignature, type SessionStartupDiagnostic } from './diagnostics'

const reports = new Map<string, Promise<string | undefined>>()

export async function getDiagnosticEnvironment() {
  const [version, os] = await Promise.all([
    platform.getVersion().catch(() => 'unknown'),
    platform.getPlatform().catch(() => 'unknown'),
  ])
  const safe = (value: string) => (/^[A-Za-z0-9._+ -]{1,80}$/.test(value) ? value : 'unknown')
  return { version: safe(version), platform: `${platform.type}/${safe(os)}` }
}

export function reportStartupFailure(sessionId: string, diagnostic: SessionStartupDiagnostic) {
  const key = `${sessionId}\n${diagnosticSignature(diagnostic)}`
  const existing = reports.get(key)
  if (existing) return existing
  const report = sendReport(diagnostic).then((reportId) => {
    if (!reportId && reports.get(key) === report) reports.delete(key)
    return reportId
  })
  reports.set(key, report)
  const oldest = reports.keys().next().value
  if (reports.size > 100 && oldest !== undefined) reports.delete(oldest)
  return report
}

async function sendReport(_diagnostic: SessionStartupDiagnostic): Promise<string | undefined> {
  return undefined
}
