import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import AreasView from "./AreasView"
import EncounterZoneCards from "./EncounterZoneCards"
import PokedexView from "./PokedexView"
import PokemonSearch from "./PokemonSearch"

describe("screen resource states", () => {
  it("renders a Pokédex loading state without fallback records", () => {
    render(
      <PokedexView
        entries={[]}
        state="loading"
        sort="national"
        filter="all"
        query=""
        generation={null}
        onSortChange={vi.fn()}
        onFilterChange={vi.fn()}
        onQueryChange={vi.fn()}
        onGenerationChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText("Loading Pokédex")).toBeInTheDocument()
  })

  it("renders a concise finder error state", () => {
    render(
      <PokemonSearch
        query="Pichu"
        results={[]}
        state="error"
        onQueryChange={vi.fn()}
        onPokemonSelect={vi.fn()}
      />,
    )
    expect(screen.getByText("Pokémon search is unavailable")).toBeInTheDocument()
    expect(screen.getByText("Unable to load Pokémon data.")).toBeInTheDocument()
  })

  it("renders the verified-place empty state", () => {
    render(<EncounterZoneCards zones={[]} sosMode={false} state="empty" />)
    expect(
      screen.getByText(
        "No verified encounter places are currently mapped for this location.",
      ),
    ).toBeInTheDocument()
  })

  it("keeps desktop and mobile location navigation available", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <AreasView
        islands={[
          {
            id: "island",
            name: "Island",
            shortLabel: "Island",
            fullName: "Island",
            color: "red",
            groupType: "island",
          },
        ]}
        activeIslandId="island"
        locations={[]}
        selectedLocationId={null}
        map={null}
        zones={[]}
        selectedZoneId={null}
        state="empty"
        timeOfDay="day"
        sosMode={false}
        onSelectIsland={vi.fn()}
        onSelectLocation={vi.fn()}
        onSelectZone={vi.fn()}
        onTimeOfDayChange={vi.fn()}
        onSosModeChange={vi.fn()}
      />,
    )
    expect(container.querySelector("aside.hidden.lg\\:block")).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", {
        name: "Open island map and location navigation",
      }),
    )
    expect(
      screen.getByRole("dialog", { name: "Location navigation" }),
    ).toBeInTheDocument()
  })
})
