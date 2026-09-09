import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type {
  ExploreLocationResponse,
  ExplorePokemonResponse,
  PokemonExploreResponse,
} from "./api/types"
import App from "./App"

function encounter(
  canonicalKey: string,
  displayName: string,
  spriteName: string,
  sosSlots: number[] = [],
): ExplorePokemonResponse {
  return {
    canonical_key: canonicalKey,
    display_name: displayName,
    species_key: canonicalKey.split(":")[0],
    species_name: displayName,
    national_dex_number: canonicalKey === "pichu" ? 172 : 25,
    alola_usum_dex_number: canonicalKey === "pichu" ? 24 : 25,
    generation: 2,
    is_regional: canonicalKey.includes(":"),
    regional_name: canonicalKey.includes(":") ? "Alola" : null,
    sprite_path: `/assets/pokemon/sprites/${spriteName}.png`,
    rate_percent: 10,
    min_level: 4,
    max_level: 6,
    sos_slots: sosSlots,
    source_table_count: 1,
  }
}

function locationBundle(locationKey: string): ExploreLocationResponse {
  const routeThree = locationKey === "route-3"
  return {
    group_key: "melemele",
    group_display_name: "Melemele",
    group_type: "island",
    location_key: locationKey,
    location_display_name: routeThree ? "Route 3" : "Route 1",
    location_type: "route",
    description: null,
    places: [
      {
        place_key: `${locationKey}-primary`,
        display_name: routeThree
          ? "Field South of the Bridge"
          : "Grass Overlooking the Bay",
        subtitle: null,
        encounter_method: "grass",
        requirement: null,
        display_order: 1,
        mapping_status: "verified",
        pools: [
          {
            time_of_day: "day",
            normal: [encounter("pichu", "Pichu", "pichu")],
            sos: [encounter("pikachu", "Pikachu", "pikachu", [1, 2, 3, 4])],
            additional_sos: [],
          },
          {
            time_of_day: "night",
            normal: [
              encounter("rattata:alola", "Alolan Rattata", "rattata-alola"),
            ],
            sos: [],
            additional_sos: [],
          },
        ],
      },
      {
        place_key: `${locationKey}-secondary`,
        display_name: "Path Behind the Rocks",
        subtitle: null,
        encounter_method: "grass",
        requirement: null,
        display_order: 2,
        mapping_status: "verified",
        pools: [
          { time_of_day: "day", normal: [], sos: [], additional_sos: [] },
          { time_of_day: "night", normal: [], sos: [], additional_sos: [] },
        ],
      },
    ],
  }
}

const pichuDetail: PokemonExploreResponse = {
  species_key: "pichu",
  national_dex_number: 172,
  display_name: "Pichu",
  generation: 2,
  alola_usum_dex_number: 24,
  selected_form: {
    form_key: "pichu",
    identifier: "pichu",
    display_name: "Pichu",
    display_name_source: "species_name",
    is_default: true,
    form_order: 1,
    is_battle_only: false,
    is_mega: false,
    is_regional: false,
    regional_name: null,
    sprite_key: "pichu",
    sprite_path: "/assets/pokemon/sprites/pichu.png",
  },
  forms: [
    {
      form_key: "pichu",
      identifier: "pichu",
      display_name: "Pichu",
      display_name_source: "species_name",
      is_default: true,
      form_order: 1,
      is_battle_only: false,
      is_mega: false,
      is_regional: false,
      regional_name: null,
      sprite_key: "pichu",
      sprite_path: "/assets/pokemon/sprites/pichu.png",
    },
  ],
  encounters: [
    {
      area_group_key: "melemele",
      area_group_name: "Melemele",
      location_key: "route-1",
      location_name: "Route 1",
      place_key: "route-1-primary",
      place_name: "Grass Overlooking the Bay",
      encounter_method: "grass",
      time_of_day: "day",
      pool_type: "normal",
      rate_percent: 10,
      min_level: 4,
      max_level: 6,
      sos_slots: [],
      source_table_count: 1,
    },
  ],
}

function installApi(options: { failSearch?: boolean } = {}) {
  const requests: string[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === "string" ? input : input.toString()
      const url = new URL(rawUrl, "http://luxdex.test")
      requests.push(`${url.pathname}${url.search}`)
      let payload: unknown
      let status = 200

      if (url.pathname === "/api/health") {
        payload = {
          status: "ok",
          service: "luxdex-app",
          version: "0.1.0",
          database: "ok",
        }
      } else if (url.pathname === "/api/geography/groups") {
        payload = [
          {
            group_key: "melemele",
            display_name: "Melemele",
            display_order: 1,
            group_type: "island",
            location_count: 2,
            encounter_place_count: 4,
          },
          {
            group_key: "akala",
            display_name: "Akala",
            display_order: 2,
            group_type: "island",
            location_count: 0,
            encounter_place_count: 0,
          },
        ]
      } else if (url.pathname === "/api/geography/groups/melemele/locations") {
        payload = [
          {
            location_key: "route-1",
            display_name: "Route 1",
            location_type: "route",
            display_order: 1,
            description: null,
            area_group_key: "melemele",
            area_group_name: "Melemele",
            encounter_place_count: 2,
          },
          {
            location_key: "route-3",
            display_name: "Route 3",
            location_type: "route",
            display_order: 2,
            description: null,
            area_group_key: "melemele",
            area_group_name: "Melemele",
            encounter_place_count: 2,
          },
        ]
      } else if (url.pathname === "/api/geography/groups/akala/locations") {
        payload = []
      } else if (url.pathname.startsWith("/api/explore/areas/melemele/")) {
        payload = locationBundle(
          url.pathname.endsWith("route-3") ? "route-3" : "route-1",
        )
      } else if (url.pathname === "/api/pokemon/search") {
        if (options.failSearch) {
          payload = { detail: "Search unavailable" }
          status = 503
        } else {
          payload = [
            {
              species_key: "pichu",
              national_dex_number: 172,
              alola_usum_dex_number: 24,
              display_name: "Pichu",
              generation: 2,
              selected_form: pichuDetail.selected_form,
            },
          ]
        }
      } else if (url.pathname === "/api/explore/pokemon/pichu") {
        payload = pichuDetail
      } else if (url.pathname === "/api/explore/pokemon/bulbasaur") {
        payload = {
          ...pichuDetail,
          species_key: "bulbasaur",
          display_name: "Bulbasaur",
          national_dex_number: 1,
          alola_usum_dex_number: null,
          selected_form: {
            ...pichuDetail.selected_form,
            form_key: "bulbasaur",
            identifier: "bulbasaur",
            display_name: "Bulbasaur",
            sprite_key: "bulbasaur",
            sprite_path: "/assets/pokemon/sprites/bulbasaur.png",
          },
          forms: [],
          encounters: [],
        }
      } else if (url.pathname === "/api/pokemon") {
        payload = {
          items: [
            {
              species_key: "bulbasaur",
              national_dex_number: 1,
              alola_usum_dex_number: 1,
              display_name: "Bulbasaur",
              generation: 1,
              default_form_key: "bulbasaur",
              default_sprite_key: "bulbasaur",
              default_sprite_path: "/assets/pokemon/sprites/bulbasaur.png",
            },
          ],
          offset: 0,
          next_offset: null,
        }
      } else {
        payload = { detail: `Unhandled test URL ${url.pathname}` }
        status = 404
      }

      return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    }),
  )
  return requests
}

beforeEach(() => {
  window.history.replaceState(null, "", "/areas/melemele/route-1")
})

describe("real-data application binding", () => {
  it("loads groups, locations and places, then switches day, SOS, place and location", async () => {
    const user = userEvent.setup()
    installApi()
    render(<App />)

    expect(
      (await screen.findAllByText("Grass Overlooking the Bay")).length,
    ).toBeGreaterThan(0)
    expect(await screen.findByText("Pichu")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Night/ }))
    expect(await screen.findByText("Alolan Rattata")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Day/ }))
    await user.click(screen.getByRole("button", { name: "SOS" }))
    expect(await screen.findByText("Pikachu")).toBeInTheDocument()
    expect(screen.getByText("SOS 1–4")).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "Path Behind the Rocks" }),
    )
    expect(
      screen.getByText("No SOS encounters in this zone"),
    ).toBeInTheDocument()

    await user.click(screen.getAllByRole("button", { name: /Route 3/ })[0])
    await waitFor(() =>
      expect(window.location.pathname).toBe("/areas/melemele/route-3"),
    )
    expect(
      (await screen.findAllByText("Field South of the Bridge")).length,
    ).toBeGreaterThan(0)

    await user.click(screen.getByRole("button", { name: "Akala" }))
    await waitFor(() => expect(window.location.pathname).toBe("/areas/akala"))
    expect(await screen.findByText("No locations loaded")).toBeInTheDocument()
  })

  it("searches canonical forms and opens grouped Find in Penumbra details", async () => {
    const user = userEvent.setup()
    installApi()
    window.history.replaceState(null, "", "/pokemon")
    render(<App />)

    await user.type(
      screen.getByRole("searchbox", { name: "Search Pokémon" }),
      "Pichu",
    )
    const result = await screen.findByRole("button", {
      name: /Pichu.*Find in Penumbra/,
    })
    await user.click(result)

    expect(await screen.findByText("Find in Penumbra")).toBeInTheDocument()
    expect(screen.getByText("USUM Alola")).toBeInTheDocument()
    expect(screen.getByText(/Grass Overlooking the Bay/)).toBeInTheDocument()
    expect(window.location.pathname).toBe("/pokemon/pichu")
  })

  it("shows clear empty and error states", async () => {
    installApi({ failSearch: true })
    window.history.replaceState(null, "", "/pokemon")
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText("Find a Pokémon")).toBeInTheDocument()
    await user.type(
      screen.getByRole("searchbox", { name: "Search Pokémon" }),
      "Pichu",
    )
    expect(
      await screen.findByText("Pokémon search is unavailable"),
    ).toBeInTheDocument()
  })

  it("requests backend-owned Alola, National and A–Z Pokédex order", async () => {
    const requests = installApi()
    window.history.replaceState(null, "", "/pokedex")
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText("Bulbasaur")).toBeInTheDocument()
    await waitFor(() =>
      expect(requests.some((url) => url.includes("order=alola"))).toBe(true),
    )

    await user.selectOptions(screen.getByLabelText("Pokédex order"), "national")
    await waitFor(() =>
      expect(requests.some((url) => url.includes("order=national"))).toBe(true),
    )

    await user.selectOptions(screen.getByLabelText("Pokédex order"), "az")
    await waitFor(() =>
      expect(requests.some((url) => url.includes("order=name"))).toBe(true),
    )

    await user.selectOptions(screen.getByLabelText("Generation filter"), "7")
    await waitFor(() =>
      expect(requests.some((url) => url.includes("generation=7"))).toBe(true),
    )
  })

  it("supports direct Pokémon links with no encounter result", async () => {
    installApi()
    window.history.replaceState(null, "", "/pokemon/bulbasaur")
    render(<App />)

    expect(
      await screen.findByText(
        "No Penumbra wild encounter was found for this Pokémon.",
      ),
    ).toBeInTheDocument()
  })
})
