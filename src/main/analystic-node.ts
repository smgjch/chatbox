import type { AnalyticsEventParams } from '../shared/analytics'
// Compatibility interface; this fork has no telemetry service.
export async function event(_name: string, _params: AnalyticsEventParams = {}) {}
