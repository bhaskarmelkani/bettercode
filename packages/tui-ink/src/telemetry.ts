// Telemetry is disabled by default in v1.0. Enable with BETTERCODE_TELEMETRY=1.
// No data is sent unless explicitly opted in.

const ENABLED = process.env.BETTERCODE_TELEMETRY === "1"

export function track(_event: string, _props?: Record<string, unknown>) {
  if (!ENABLED) return
  // No-op in v1.0 — telemetry infrastructure is gated behind opt-in.
}
