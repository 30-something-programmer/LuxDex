import { describe, expect, it } from "vitest"
import { parseRoute, routePath } from "./routing"

describe("URL routing", () => {
  it("round-trips stable area and canonical form keys", () => {
    expect(parseRoute("/areas/melemele/route-1")).toEqual({
      view: "areas",
      groupKey: "melemele",
      locationKey: "route-1",
    })
    expect(routePath({ view: "pokemon", canonicalKey: "rattata:alola" })).toBe(
      "/pokemon/rattata%3Aalola",
    )
    expect(parseRoute("/pokemon/rattata%3Aalola")).toEqual({
      view: "pokemon",
      canonicalKey: "rattata:alola",
    })
  })
})
