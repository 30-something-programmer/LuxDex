import type { HealthResponse } from "./types"

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/$/,
  "",
)

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export async function request<T>(
  path: string,
  signal?: AbortSignal,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
    signal,
  })

  if (!response.ok) {
    let message = `LuxDex API returned ${response.status}.`
    try {
      const payload = (await response.json()) as { detail?: unknown }
      if (typeof payload.detail === "string") message = payload.detail
    } catch {
      // The status is still useful when an upstream response has no JSON body.
    }
    throw new ApiError(response.status, message)
  }

  return (await response.json()) as T
}

export function queryString(
  values: Record<string, string | number | boolean | null | undefined>,
): string {
  const parameters = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value != null && value !== "") parameters.set(key, String(value))
  }
  const query = parameters.toString()
  return query ? `?${query}` : ""
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>("/health", signal)
}
