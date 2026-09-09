import { useEffect, useState } from "react"
import { getHealth } from "./api/client"
import type { HealthResponse } from "./api/types"
import AreasView from "./components/AreasView"
import PokedexView from "./components/PokedexView"
import PokePanel from "./components/PokePanel"
import PokemonSearch from "./components/PokemonSearch"
import type {
  EncounterZoneModel,
  IslandOption,
  LocationOption,
  PokedexEntryModel,
  PokedexSort,
  PokemonCardModel,
  PokemonSearchResultModel,
  ResourceState,
  StatusFilter,
  TimeOfDay,
} from "./types/presentation"

type Tab = "areas" | "pokemon" | "pokedex"
type Theme = "dark" | "light"

interface TabItem {
  key: Tab
  label: string
  path: string
}

const EMPTY_ISLANDS: IslandOption[] = []
const EMPTY_LOCATIONS: LocationOption[] = []
const EMPTY_ZONES: EncounterZoneModel[] = []
const EMPTY_SEARCH_RESULTS: PokemonSearchResultModel[] = []
const EMPTY_POKEDEX: PokedexEntryModel[] = []

const TABS: TabItem[] = [
  {
    key: "areas",
    label: "Areas",
    path: "M9 20 3.55 17.28A1 1 0 0 1 3 16.38V5.62a1 1 0 0 1 1.45-.9L9 7m0 13 6-3M9 20V7m6 10 4.55 2.28A1 1 0 0 0 21 18.38V7.62a1 1 0 0 0-.55-.9L15 4m0 13V4m0 0L9 7",
  },
  {
    key: "pokemon",
    label: "Pokémon",
    path: "m21 21-6-6m2-5A7 7 0 1 1 3 10a7 7 0 0 1 14 0Z",
  },
  {
    key: "pokedex",
    label: "Pokédex",
    path: "M12 6.25v13m0-13C10.83 5.48 9.25 5 7.5 5S4.17 5.48 3 6.25v13C4.17 18.48 5.75 18 7.5 18s3.33.48 4.5 1.25m0-13C13.17 5.48 14.75 5 16.5 5s3.33.48 4.5 1.25v13C19.83 18.48 18.25 18 16.5 18s-3.33.48-4.5 1.25",
  },
]

function SunIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>("areas")
  const [theme, setTheme] = useState<Theme>("dark")
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [activeIslandId, setActiveIslandId] = useState<string | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  )
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("day")
  const [sosMode, setSosMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [pokedexQuery, setPokedexQuery] = useState("")
  const [pokedexSort, setPokedexSort] = useState<PokedexSort>("alola")
  const [pokedexFilter, setPokedexFilter] = useState<StatusFilter>("all")
  const [selectedPokemon, setSelectedPokemon] =
    useState<PokedexEntryModel | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getHealth(controller.signal)
      .then((response) => {
        setHealth(response)
        setHealthError(null)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setHealthError(
          error instanceof Error
            ? error.message
            : "The API health check failed.",
        )
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (theme === "light") document.documentElement.dataset.theme = "light"
    else delete document.documentElement.dataset.theme
  }, [theme])

  const dataState: ResourceState = health
    ? "empty"
    : healthError
      ? "error"
      : "loading"
  const connectionLabel = health
    ? `API connected · ${health.database.replace("_", " ")}`
    : healthError
      ? "API unavailable"
      : "Checking API"

  const openFinder = (pokemon: PokemonCardModel) => {
    setSelectedPokemon(null)
    setSearchQuery(pokemon.name)
    setTab("pokemon")
  }

  const goToLocation = (locationId: string) => {
    setSelectedLocationId(locationId)
    setTab("areas")
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-bg)]">
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "areas" && (
          <AreasView
            islands={EMPTY_ISLANDS}
            activeIslandId={activeIslandId}
            locations={EMPTY_LOCATIONS}
            selectedLocationId={selectedLocationId}
            map={null}
            zones={EMPTY_ZONES}
            state={dataState}
            timeOfDay={timeOfDay}
            sosMode={sosMode}
            onSelectIsland={setActiveIslandId}
            onSelectLocation={setSelectedLocationId}
            onTimeOfDayChange={setTimeOfDay}
            onSosModeChange={setSosMode}
            onPokemonSelect={setSelectedPokemon}
          />
        )}
        {tab === "pokemon" && (
          <PokemonSearch
            query={searchQuery}
            results={EMPTY_SEARCH_RESULTS}
            state={dataState}
            onQueryChange={setSearchQuery}
            onPokemonSelect={setSelectedPokemon}
            onGoToLocation={goToLocation}
          />
        )}
        {tab === "pokedex" && (
          <PokedexView
            entries={EMPTY_POKEDEX}
            state={dataState}
            sort={pokedexSort}
            filter={pokedexFilter}
            query={pokedexQuery}
            totalCount={0}
            seenCount={0}
            ownedCount={0}
            onSortChange={setPokedexSort}
            onFilterChange={setPokedexFilter}
            onQueryChange={setPokedexQuery}
            onPokemonSelect={setSelectedPokemon}
          />
        )}
      </div>

      <nav
        className="flex flex-shrink-0 items-stretch border-t border-[var(--color-border)] bg-[var(--color-surface)]"
        aria-label="Primary navigation"
      >
        {TABS.map((item) => (
          <button
            key={item.key}
            className={`flex flex-1 flex-col items-center gap-0.5 px-2 py-2.5 transition-colors ${
              tab === item.key
                ? "text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            type="button"
            onClick={() => setTab(item.key)}
            aria-current={tab === item.key ? "page" : undefined}
          >
            <svg
              className={`h-5 w-5 ${tab === item.key ? "scale-110" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={tab === item.key ? 2.5 : 1.8}
              aria-hidden="true"
            >
              <path
                d={item.path}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className={`text-[10px] font-bold leading-none ${
                tab === item.key ? "text-[var(--color-accent)]" : ""
              }`}
            >
              {item.label}
            </span>
            {tab === item.key && (
              <span
                className="h-1 w-1 rounded-full bg-[var(--color-accent)]"
                aria-hidden="true"
              />
            )}
          </button>
        ))}

        <button
          className="relative flex flex-col items-center gap-0.5 border-l border-[var(--color-border)] px-3 py-2.5 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          type="button"
          onClick={() =>
            setTheme((current) => (current === "dark" ? "light" : "dark"))
          }
          title={`${
            theme === "dark" ? "Use light theme" : "Use dark theme"
          } · ${connectionLabel}`}
          aria-label={`${
            theme === "dark" ? "Use light theme" : "Use dark theme"
          }. ${connectionLabel}`}
        >
          <span
            className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${
              health
                ? "bg-[var(--color-success)]"
                : healthError
                  ? "bg-[var(--color-danger)]"
                  : "animate-pulse bg-[var(--color-accent)]"
            }`}
            aria-hidden="true"
          />
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          <span className="text-[9px] font-bold">
            {theme === "dark" ? "Light" : "Dark"}
          </span>
        </button>
      </nav>

      <PokePanel
        pokemon={selectedPokemon}
        onClose={() => setSelectedPokemon(null)}
        onFindElsewhere={openFinder}
      />
    </div>
  )
}
