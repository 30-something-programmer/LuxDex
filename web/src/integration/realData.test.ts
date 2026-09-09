import { describe, expect, it } from "vitest"
import { getLocationExplore, getPokemonExplore } from "../api/explore"
import { getAreaGroups, getLocations } from "../api/geography"
import { listPokemon, searchPokemon } from "../api/pokemon"
import { toEncounterZones, toPokemonDetail } from "../presentation/adapters"

const integrationTest = process.env.LUXDEX_INTEGRATION === "1" ? it : it.skip

describe("live LuxDex frontend data flow", () => {
  integrationTest(
    "drives the required screens from the real API and PostgreSQL data",
    async () => {
      const groups = await getAreaGroups()
      expect(groups.map((group) => group.group_key)).toEqual([
        "melemele",
        "akala",
        "ulaula",
        "poni",
        "other-special",
      ])

      const locations = await getLocations("melemele")
      expect(locations.map((location) => location.location_key)).toEqual(
        expect.arrayContaining(["route-1", "route-3", "kalae-bay"]),
      )

      const [routeOne, routeThree, kalaeBay] = await Promise.all([
        getLocationExplore("melemele", "route-1"),
        getLocationExplore("melemele", "route-3"),
        getLocationExplore("melemele", "kalae-bay"),
      ])
      expect(routeOne.places).toHaveLength(4)
      expect(routeThree.places).toHaveLength(4)
      expect(kalaeBay.places).toHaveLength(4)

      const routeOneDay = toEncounterZones(routeOne, "day")
      const routeOneNight = toEncounterZones(routeOne, "night")
      expect(routeOneDay.some((place) => place.encounters.length > 0)).toBe(true)
      expect(routeOneNight.some((place) => place.encounters.length > 0)).toBe(true)
      const pikachuSos = routeOneDay
        .flatMap((place) => place.sosEncounters)
        .find((pokemon) => pokemon.canonicalKey === "pikachu")
      expect(pikachuSos?.sosSlots).toEqual([1, 2, 3, 4])
      expect(pikachuSos?.rate).toBe(10)

      const [pichu, alolanRattata, pikachu, absent] = await Promise.all([
        getPokemonExplore("pichu"),
        getPokemonExplore("rattata:alola"),
        getPokemonExplore("pikachu"),
        getPokemonExplore("bulbasaur"),
      ])
      expect(toPokemonDetail(pichu).occurrences.length).toBeGreaterThan(0)
      expect(alolanRattata.selected_form.display_name).toBe("Alolan Rattata")
      expect(pikachu.encounters.some((encounter) => encounter.pool_type === "sos")).toBe(true)
      expect(absent.encounters).toEqual([])

      for (const name of [
        "Pichu",
        "Pikachu",
        "Rattata",
        "Type: Null",
        "Mr. Mime",
        "Farfetch'd",
      ]) {
        expect(await searchPokemon(name)).not.toHaveLength(0)
      }

      const [national, alola, alphabetical] = await Promise.all([
        listPokemon({ order: "national" }),
        listPokemon({ order: "alola" }),
        listPokemon({ order: "name" }),
      ])
      expect(national.items).toHaveLength(807)
      expect(national.items[0].national_dex_number).toBe(1)
      expect(national.items[national.items.length - 1]?.national_dex_number).toBe(807)
      expect(alola.items).toHaveLength(403)
      expect(alola.items[alola.items.length - 1]?.alola_usum_dex_number).toBe(403)
      expect(alphabetical.items[0].display_name).toBe("Abomasnow")
      const filtered = await listPokemon({ order: "name", query: "Mr. Mime" })
      expect(filtered.items.map((item) => item.display_name)).toEqual(["Mr. Mime"])

      const spritePath = pichu.selected_form.sprite_path
      expect(spritePath).toMatch(/^\/assets\/pokemon\/sprites\//)
      const spriteResponse = await fetch(`http://localhost:52030${spritePath}`)
      expect(spriteResponse.status).toBe(200)
      expect(spriteResponse.headers.get("content-type")).toContain("image/png")
    },
    20_000,
  )
})
