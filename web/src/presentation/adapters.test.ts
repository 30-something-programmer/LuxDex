import { describe, expect, it } from "vitest"
import type {
  ExploreLocationResponse,
  ExplorePokemonResponse,
} from "../api/types"
import { toEncounterZones } from "./adapters"

function pokemon(
  canonicalKey: string,
  displayName: string,
  overrides: Partial<ExplorePokemonResponse> = {},
): ExplorePokemonResponse {
  return {
    canonical_key: canonicalKey,
    display_name: displayName,
    species_key: canonicalKey.split(":")[0],
    species_name: displayName,
    national_dex_number: 1,
    alola_usum_dex_number: 1,
    generation: 1,
    is_regional: false,
    regional_name: null,
    sprite_path: `/assets/pokemon/sprites/${canonicalKey.replace(":", "-")}.png`,
    rate_percent: 10,
    min_level: 4,
    max_level: 6,
    sos_slots: [],
    source_table_count: 1,
    collection_state: "unseen",
    ...overrides,
  }
}

const location: ExploreLocationResponse = {
  group_key: "melemele",
  group_display_name: "Melemele",
  group_type: "island",
  location_key: "route-1",
  location_display_name: "Route 1",
  location_type: "route",
  description: null,
  places: [
    {
      place_key: "route-1-bay",
      display_name: "Grass Overlooking the Bay",
      subtitle: null,
      encounter_method: "grass",
      requirement: null,
      display_order: 1,
      mapping_status: "verified",
      pools: [
        {
          time_of_day: "day",
          normal: [pokemon("pichu", "Pichu")],
          sos: [pokemon("pikachu", "Pikachu", { sos_slots: [1, 2, 3, 4] })],
          additional_sos: [],
        },
        {
          time_of_day: "night",
          normal: [pokemon("rattata:alola", "Alolan Rattata")],
          sos: [],
          additional_sos: [
            pokemon("raichu:alola", "Alolan Raichu", {
              rate_percent: null,
              min_level: null,
              max_level: null,
            }),
          ],
        },
      ],
    },
  ],
}

describe("explore presentation adapters", () => {
  it("switches day and night without losing canonical forms", () => {
    expect(toEncounterZones(location, "day")[0].encounters[0]).toMatchObject({
      canonicalKey: "pichu",
      name: "Pichu",
      rate: 10,
    })
    expect(toEncounterZones(location, "night")[0].encounters[0]).toMatchObject({
      canonicalKey: "rattata:alola",
      name: "Alolan Rattata",
    })
  })

  it("preserves consolidated SOS slots and additional SOS context", () => {
    const day = toEncounterZones(location, "day")[0]
    expect(day.sosEncounters[0].sosSlots).toEqual([1, 2, 3, 4])
    expect(day.sosEncounters[0].rate).toBe(10)

    const night = toEncounterZones(location, "night")[0]
    expect(night.additionalSosEncounters[0]).toMatchObject({
      canonicalKey: "raichu:alola",
      contextLabel: "Additional SOS",
      rate: null,
    })
  })
})
