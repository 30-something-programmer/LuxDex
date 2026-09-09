import { describe, expect, it } from "vitest"
import { environmentStyleFor } from "./environments"

describe("encounter-place environment classification", () => {
  it("classifies verified Melemele places using method and display text only", () => {
    expect(
      environmentStyleFor("grass", "Tall Grass"),
    ).toBe("tall-grass")
    expect(
      environmentStyleFor("grass", "Grass Overlooking the Bay"),
    ).toBe("meadow-ocean")
    expect(
      environmentStyleFor("grass", "First Two Fields East of the Player's House"),
    ).toBe("meadow")
    expect(
      environmentStyleFor("surf", "Surfing from the Beach"),
    ).toBe("beach-water")
    expect(environmentStyleFor("fishing", "Fishing")).toBe("water")
    expect(
      environmentStyleFor("bubbling_fishing", "Bubbling Fishing Spot", "Route 1 side"),
    ).toBe("water")
    expect(environmentStyleFor("berry_pile", "Berry Pile by the Berry Tree")).toBe(
      "meadow",
    )
    expect(
      environmentStyleFor("moving_shadow", "Ambush Encounters", "Flying Pokémon shadows"),
    ).toBe("forest")
  })

  it("does not classify a location as urban just because a nearby town is named", () => {
    // "Iki Town" is a proximity reference on a grass path, not an urban place.
    expect(
      environmentStyleFor("grass", "Grass Near Iki Town and on the Western Path"),
    ).not.toBe("urban")
    expect(
      environmentStyleFor("grass", "Path South of Iki Town Behind Rocks"),
    ).not.toBe("urban")
  })

  it("falls back to a neutral meadow for an unrecognised grass-method place", () => {
    expect(environmentStyleFor("grass", "Somewhere Unnamed")).toBe("meadow")
  })
})
