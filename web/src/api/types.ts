export interface HealthResponse {
  status: "ok" | "degraded"
  service: "luxdex-app"
  version: string
  database: "ok" | "not_configured" | "unavailable"
}
