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
    collection_state: "unseen",
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
    collection_state: "unseen",
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
      collection_state: "unseen",
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

function installApi(options: { failSearch?: boolean; failMutation?: boolean } = {}) {
  const requests: string[] = []
  let pichuState: "unseen" | "seen" | "owned" = "unseen"
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
      } else if (url.pathname === "/api/collection/summary") {
        const seen = pichuState === "seen" ? 1 : 0
        const owned = pichuState === "owned" ? 1 : 0
        payload = {
          profile_key: "local",
          form_counts: { total: 1127, unseen: 1127 - seen - owned, seen, owned },
          national_species_counts: { total: 807, unseen: 807 - seen - owned, seen, owned },
          alola_species_counts: { total: 403, unseen: 403 - seen - owned, seen, owned },
        }
      } else if (
        url.pathname === "/api/collection/pichu/advance" &&
        init?.method === "POST"
      ) {
        if (options.failMutation) {
          payload = { detail: "Mutation failed" }
          status = 503
        } else {
          pichuState = pichuState === "unseen" ? "seen" : "owned"
          payload = {
            canonical_key: "pichu",
            display_name: "Pichu",
            state: pichuState,
            first_seen_at: "2026-09-09T10:00:00Z",
            first_owned_at: pichuState === "owned" ? "2026-09-09T10:01:00Z" : null,
            updated_at: "2026-09-09T10:01:00Z",
          }
        }
      } else if (
        url.pathname === "/api/collection/pichu" &&
        init?.method === "PUT"
      ) {
        pichuState = (JSON.parse(String(init.body)) as { state: typeof pichuState }).state
        payload = {
          canonical_key: "pichu",
          display_name: "Pichu",
          state: pichuState,
          first_seen_at: "2026-09-09T10:00:00Z",
          first_owned_at: "2026-09-09T10:01:00Z",
          updated_at: "2026-09-09T10:02:00Z",
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
        for (const place of (payload as ExploreLocationResponse).places)
          for (const pool of place.pools)
            for (const pokemon of [...pool.normal, ...pool.sos, ...pool.additional_sos])
              if (pokemon.canonical_key === "pichu") pokemon.collection_state = pichuState
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
              selected_form: { ...pichuDetail.selected_form, collection_state: pichuState },
            },
          ]
        }
      } else if (url.pathname === "/api/explore/pokemon/pichu") {
        payload = {
          ...pichuDetail,
          selected_form: { ...pichuDetail.selected_form, collection_state: pichuState },
          forms: pichuDetail.forms.map((form) => ({ ...form, collection_state: pichuState })),
        }
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
              collection_state: "unseen",
            },
            {
              species_key: "pichu",
              national_dex_number: 172,
              alola_usum_dex_number: 24,
              display_name: "Pichu",
              generation: 2,
              default_form_key: "pichu",
              default_sprite_key: "pichu",
              default_sprite_path: "/assets/pokemon/sprites/pichu.png",
              collection_state: pichuState,
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
    expect(
      await screen.findByText("Locations will appear as mapping is verified."),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Some encounter areas on Akala are still being mapped/),
    ).toBeInTheDocument()
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
      name: /Pichu.*Unseen/,
    })
    await user.click(result)

    expect(await screen.findByText("Find in Penumbra")).toBeInTheDocument()
    expect(screen.getByText("USUM Alola")).toBeInTheDocument()
    expect(screen.getByText(/Grass Overlooking the Bay/)).toBeInTheDocument()
    expect(window.location.pathname).toBe("/pokemon/pichu")

    await user.keyboard("{Escape}")
    await waitFor(() => expect(window.location.pathname).toBe("/pokemon"))
  })

  it("restores an areas view when history navigation returns to it", async () => {
    const user = userEvent.setup()
    installApi()
    render(<App />)

    expect(
      (await screen.findAllByText("Grass Overlooking the Bay")).length,
    ).toBeGreaterThan(0)

    await user.click(screen.getByRole("button", { name: /Pokédex/ }))
    await waitFor(() => expect(window.location.pathname).toBe("/pokedex"))
    expect(screen.queryByText("Grass Overlooking the Bay")).not.toBeInTheDocument()

    window.history.back()
    await waitFor(() =>
      expect(window.location.pathname).toBe("/areas/melemele/route-1"),
    )
    expect(
      (await screen.findAllByText("Grass Overlooking the Bay")).length,
    ).toBeGreaterThan(0)
    // The URL must not be overwritten by stale component state once restored.
    expect(window.location.pathname).toBe("/areas/melemele/route-1")
  })

  it("moves through Back and Forward across an area and a location change", async () => {
    const user = userEvent.setup()
    installApi()
    render(<App />)

    expect(
      (await screen.findAllByText("Grass Overlooking the Bay")).length,
    ).toBeGreaterThan(0)

    await user.click(screen.getAllByRole("button", { name: /Route 3/ })[0])
    await waitFor(() =>
      expect(window.location.pathname).toBe("/areas/melemele/route-3"),
    )
    expect(
      (await screen.findAllByText("Field South of the Bridge")).length,
    ).toBeGreaterThan(0)

    await user.click(screen.getByRole("button", { name: "Akala" }))
    await waitFor(() => expect(window.location.pathname).toBe("/areas/akala"))
    expect(
      await screen.findByText("Locations will appear as mapping is verified."),
    ).toBeInTheDocument()

    window.history.back()
    await waitFor(() =>
      expect(window.location.pathname).toBe("/areas/melemele/route-3"),
    )
    expect(
      (await screen.findAllByText("Field South of the Bridge")).length,
    ).toBeGreaterThan(0)

    window.history.back()
    await waitFor(() =>
      expect(window.location.pathname).toBe("/areas/melemele/route-1"),
    )
    expect(
      (await screen.findAllByText("Grass Overlooking the Bay")).length,
    ).toBeGreaterThan(0)

    window.history.forward()
    await waitFor(() =>
      expect(window.location.pathname).toBe("/areas/melemele/route-3"),
    )
    expect(
      (await screen.findAllByText("Field South of the Bridge")).length,
    ).toBeGreaterThan(0)

    window.history.forward()
    await waitFor(() => expect(window.location.pathname).toBe("/areas/akala"))
    expect(
      await screen.findByText("Locations will appear as mapping is verified."),
    ).toBeInTheDocument()
  })

  it("renders a deep link straight to a nested area location on first mount", async () => {
    installApi()
    window.history.replaceState(null, "", "/areas/melemele/route-3")
    render(<App />)

    expect(
      (await screen.findAllByText("Field South of the Bridge")).length,
    ).toBeGreaterThan(0)
    expect(window.location.pathname).toBe("/areas/melemele/route-3")
  })

  it("settles on the latest location when navigation happens faster than requests resolve", async () => {
    const user = userEvent.setup()
    installApi()
    render(<App />)

    expect(
      (await screen.findAllByText("Grass Overlooking the Bay")).length,
    ).toBeGreaterThan(0)

    const routeThreeButton = screen.getAllByRole("button", {
      name: /Route 3/,
    })[0]
    await user.click(routeThreeButton)
    window.history.back()

    await waitFor(() =>
      expect(window.location.pathname).toBe("/areas/melemele/route-1"),
    )
    expect(
      (await screen.findAllByText("Grass Overlooking the Bay")).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText("Field South of the Bridge")).not.toBeInTheDocument()
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

    expect((await screen.findAllByText("???")).length).toBeGreaterThan(0)
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

  it("advances globally, filters the Pokédex, and explicitly resets detail state", async () => {
    const user = userEvent.setup()
    installApi()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Mark Seen" }))
    expect(await screen.findByRole("button", { name: "Mark Owned" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Pokédex/ }))
    expect(await screen.findByText("Pichu")).toBeInTheDocument()
    expect(screen.getByText("1 seen")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Seen" }))
    expect(screen.getByText("Pichu")).toBeInTheDocument()
    expect(screen.queryByText("Bulbasaur")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /A-024.*Pichu/ }))
    await user.click(await screen.findByRole("button", { name: "Mark Owned" }))
    expect(screen.getByText("owned", { selector: ".capitalize" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Reset to Unseen" }))
    expect(screen.getByText("unseen", { selector: ".capitalize" })).toBeInTheDocument()
  })

  it("rolls back an optimistic quick action when the API fails", async () => {
    const user = userEvent.setup()
    installApi({ failMutation: true })
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Mark Seen" }))
    expect(
      await screen.findByText("Collection update failed. Your previous status was restored."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Mark Seen" })).toBeInTheDocument()
  })
})
