import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiError, getHealth, queryString, request } from "./client"

afterEach(() => vi.unstubAllGlobals())

describe("API client", () => {
  it("uses the central /api boundary and parses JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          service: "luxdex-app",
          version: "0.1.0",
          database: "ok",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(getHealth()).resolves.toMatchObject({ database: "ok" })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    )
  })

  it("turns API failures into typed errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Location not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      ))

    await expect(request("/missing")).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: "ApiError",
        status: 404,
        message: "Location not found",
      }),
    )
  })

  it("omits empty query values", () => {
    expect(queryString({ order: "alola", generation: null, q: "" })).toBe(
      "?order=alola",
    )
  })
})
