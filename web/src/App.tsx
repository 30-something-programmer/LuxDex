import { useCallback, useEffect, useMemo, useState } from "react"
import { getHealth } from "./api/client"
import {
  advanceCollection,
  getCollectionSummary,
  setCollectionState,
} from "./api/collection"
import { getLocationExplore, getPokemonExplore } from "./api/explore"
import { getAreaGroups, getLocations } from "./api/geography"
import { listPokemon, searchPokemon } from "./api/pokemon"
import type {
  AreaGroupResponse,
  CollectionState,
  CollectionSummaryResponse,
  ExploreLocationResponse,
  HealthResponse,
  LocationResponse,
} from "./api/types"
import AreasView from "./components/AreasView"
import PokedexView from "./components/PokedexView"
import PokePanel from "./components/PokePanel"
import PokemonSearch from "./components/PokemonSearch"
import { parseRoute, routePath, type AppRoute } from "./lib/routing"
import {
  toEncounterZones,
  toIslandOptions,
  toLocationOptions,
  toPokedexEntries,
  toPokemonDetail,
  toSearchResults,
} from "./presentation/adapters"
import { buildIslandMap } from "./presentation/islandMaps"
import type {
  PokedexEntryModel,
  PokedexSort,
  PokemonDetailModel,
  PokemonSearchResultModel,
  ResourceState,
  StatusFilter,
  TimeOfDay,
} from "./types/presentation"

type Theme = "dark" | "light"

interface TabItem {
  key: AppRoute["view"]
  label: string
  path: string
}

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

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

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
  const [route, setRoute] = useState<AppRoute>(() =>
    parseRoute(window.location.pathname),
  )
  const [lastAreaRoute, setLastAreaRoute] = useState<AppRoute>({
    view: "areas",
    groupKey: null,
    locationKey: null,
  })
  const [theme, setTheme] = useState<Theme>("dark")
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthError, setHealthError] = useState(false)
  const [collectionSummary, setCollectionSummary] =
    useState<CollectionSummaryResponse | null>(null)
  const [collectionError, setCollectionError] = useState<string | null>(null)
  const [mutatingKey, setMutatingKey] = useState<string | null>(null)

  const [groups, setGroups] = useState<AreaGroupResponse[]>([])
  const [groupsState, setGroupsState] = useState<ResourceState>("loading")
  const [locations, setLocations] = useState<LocationResponse[]>([])
  const [locationsGroupKey, setLocationsGroupKey] = useState<string | null>(
    null,
  )
  const [locationsState, setLocationsState] = useState<ResourceState>("empty")
  const [locationExplore, setLocationExplore] =
    useState<ExploreLocationResponse | null>(null)
  const [locationState, setLocationState] = useState<ResourceState>("empty")
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("day")
  const [sosMode, setSosMode] = useState(false)
  const [areasReloadKey, setAreasReloadKey] = useState(0)

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] =
    useState<PokemonSearchResultModel[]>([])
  const [searchState, setSearchState] = useState<ResourceState>("empty")
  const [pokemonDetail, setPokemonDetail] = useState<PokemonDetailModel | null>(
    null,
  )
  const [pokemonDetailState, setPokemonDetailState] =
    useState<ResourceState>("empty")

  const [pokedexQuery, setPokedexQuery] = useState("")
  const [pokedexSort, setPokedexSort] = useState<PokedexSort>("alola")
  const [pokedexGeneration, setPokedexGeneration] = useState<number | null>(
    null,
  )
  const [pokedexFilter, setPokedexFilter] = useState<StatusFilter>("all")
  const [pokedexEntries, setPokedexEntries] = useState<PokedexEntryModel[]>([])
  const [pokedexState, setPokedexState] = useState<ResourceState>("empty")

  const navigate = useCallback((nextRoute: AppRoute, replace = false) => {
    const path = routePath(nextRoute)
    if (replace) window.history.replaceState(null, "", path)
    else window.history.pushState(null, "", path)
    setRoute(nextRoute)
  }, [])

  useEffect(() => {
    const onPopState = () => setRoute(parseRoute(window.location.pathname))
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const refreshCollectionSummary = useCallback((signal?: AbortSignal) => {
    getCollectionSummary(signal)
      .then(setCollectionSummary)
      .catch((error: unknown) => {
        if (!isAbort(error)) setCollectionError("Collection progress is unavailable.")
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    refreshCollectionSummary(controller.signal)
    return () => controller.abort()
  }, [refreshCollectionSummary])

  useEffect(() => {
    if (route.view === "areas") setLastAreaRoute(route)
  }, [route])

  useEffect(() => {
    if (theme === "light") document.documentElement.dataset.theme = "light"
    else delete document.documentElement.dataset.theme
  }, [theme])

  useEffect(() => {
    const controller = new AbortController()
    getHealth(controller.signal)
      .then((response) => {
        setHealth(response)
        setHealthError(false)
      })
      .catch((error: unknown) => {
        if (!isAbort(error)) setHealthError(true)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setGroupsState("loading")
    getAreaGroups(controller.signal)
      .then((items) => {
        setGroups(items)
        setGroupsState(items.length ? "ready" : "empty")
      })
      .catch((error: unknown) => {
        if (!isAbort(error)) setGroupsState("error")
      })
    return () => controller.abort()
  }, [areasReloadKey])

  useEffect(() => {
    if (route.view !== "areas" || groupsState !== "ready") return
    if (
      route.groupKey &&
      groups.some((group) => group.group_key === route.groupKey)
    )
      return
    const firstGroup = groups[0]
    if (firstGroup) {
      navigate(
        { view: "areas", groupKey: firstGroup.group_key, locationKey: null },
        true,
      )
    }
  }, [groups, groupsState, navigate, route])

  useEffect(() => {
    if (route.view !== "areas" || !route.groupKey) {
      setLocations([])
      setLocationsGroupKey(null)
      setLocationsState("empty")
      return
    }
    const controller = new AbortController()
    setLocations([])
    setLocationsGroupKey(null)
    setLocationsState("loading")
    getLocations(route.groupKey, controller.signal)
      .then((items) => {
        setLocations(items)
        setLocationsGroupKey(route.groupKey)
        setLocationsState(items.length ? "ready" : "empty")
      })
      .catch((error: unknown) => {
        if (!isAbort(error)) setLocationsState("error")
      })
    return () => controller.abort()
  }, [
    areasReloadKey,
    route.view,
    route.view === "areas" ? route.groupKey : null,
  ])

  useEffect(() => {
    if (
      route.view !== "areas" ||
      !route.groupKey ||
      locationsGroupKey !== route.groupKey ||
      locationsState !== "ready"
    )
      return
    if (
      route.locationKey &&
      locations.some((location) => location.location_key === route.locationKey)
    )
      return
    const firstLocation = locations[0]
    if (firstLocation) {
      navigate(
        {
          view: "areas",
          groupKey: route.groupKey,
          locationKey: firstLocation.location_key,
        },
        true,
      )
    }
  }, [locations, locationsGroupKey, locationsState, navigate, route])

  useEffect(() => {
    if (route.view !== "areas" || !route.groupKey || !route.locationKey) {
      setLocationExplore(null)
      setLocationState("empty")
      setSelectedPlaceId(null)
      return
    }
    const controller = new AbortController()
    setLocationExplore(null)
    setLocationState("loading")
    getLocationExplore(route.groupKey, route.locationKey, controller.signal)
      .then((response) => {
        setLocationExplore(response)
        setLocationState(response.places.length ? "ready" : "empty")
        setSelectedPlaceId(response.places[0]?.place_key ?? null)
      })
      .catch((error: unknown) => {
        if (!isAbort(error)) setLocationState("error")
      })
    return () => controller.abort()
  }, [
    areasReloadKey,
    route.view,
    route.view === "areas" ? route.groupKey : null,
    route.view === "areas" ? route.locationKey : null,
  ])

  useEffect(() => {
    const normalizedQuery = searchQuery.trim()
    if (!normalizedQuery) {
      setSearchResults([])
      setSearchState("empty")
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearchState("loading")
      searchPokemon(normalizedQuery, controller.signal)
        .then((response) => {
          const results = toSearchResults(response)
          setSearchResults(results)
          setSearchState(results.length ? "ready" : "empty")
        })
        .catch((error: unknown) => {
          if (!isAbort(error)) setSearchState("error")
        })
    }, 180)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [searchQuery])

  const selectedCanonicalKey =
    route.view === "pokemon" ? route.canonicalKey : null
  useEffect(() => {
    if (!selectedCanonicalKey) {
      setPokemonDetail(null)
      setPokemonDetailState("empty")
      return
    }
    const controller = new AbortController()
    setPokemonDetail(null)
    setPokemonDetailState("loading")
    getPokemonExplore(selectedCanonicalKey, controller.signal)
      .then((response) => {
        setPokemonDetail(toPokemonDetail(response))
        setPokemonDetailState("ready")
      })
      .catch((error: unknown) => {
        if (!isAbort(error)) setPokemonDetailState("error")
      })
    return () => controller.abort()
  }, [selectedCanonicalKey])

  useEffect(() => {
    if (route.view !== "pokedex") return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setPokedexState("loading")
      listPokemon(
        {
          order: pokedexSort === "az" ? "name" : pokedexSort,
          generation: pokedexGeneration,
          query: pokedexQuery,
        },
        controller.signal,
      )
        .then((response) => {
          const entries = toPokedexEntries(response.items)
          setPokedexEntries(entries)
          setPokedexState(entries.length ? "ready" : "empty")
        })
        .catch((error: unknown) => {
          if (!isAbort(error)) setPokedexState("error")
        })
    }, 120)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [pokedexGeneration, pokedexQuery, pokedexSort, route.view])

  const islands = useMemo(() => toIslandOptions(groups), [groups])
  const activeAreaGroup =
    route.view === "areas"
      ? groups.find((group) => group.group_key === route.groupKey)
      : undefined
  const mappingInProgress = activeAreaGroup?.location_count === 0
  const locationOptions = useMemo(
    () => toLocationOptions(locations),
    [locations],
  )
  const islandMap = useMemo(
    () =>
      buildIslandMap(
        route.view === "areas" ? (route.groupKey ?? "") : "",
        route.view === "areas" && locationsGroupKey === route.groupKey
          ? locations
          : [],
      ),
    [locations, locationsGroupKey, route],
  )
  const zones = useMemo(
    () => toEncounterZones(locationExplore, timeOfDay),
    [locationExplore, timeOfDay],
  )

  const applyCollectionState = useCallback(
    (canonicalKey: string, status: CollectionState) => {
      setLocationExplore((current) =>
        current
          ? {
              ...current,
              places: current.places.map((place) => ({
                ...place,
                pools: place.pools.map((pool) => ({
                  ...pool,
                  normal: pool.normal.map((pokemon) =>
                    pokemon.canonical_key === canonicalKey
                      ? { ...pokemon, collection_state: status }
                      : pokemon,
                  ),
                  sos: pool.sos.map((pokemon) =>
                    pokemon.canonical_key === canonicalKey
                      ? { ...pokemon, collection_state: status }
                      : pokemon,
                  ),
                  additional_sos: pool.additional_sos.map((pokemon) =>
                    pokemon.canonical_key === canonicalKey
                      ? { ...pokemon, collection_state: status }
                      : pokemon,
                  ),
                })),
              })),
            }
          : current,
      )
      setSearchResults((current) =>
        current.map((result) =>
          result.pokemon.canonicalKey === canonicalKey
            ? { ...result, pokemon: { ...result.pokemon, status } }
            : result,
        ),
      )
      setPokedexEntries((current) =>
        current.map((entry) =>
          entry.canonicalKey === canonicalKey ? { ...entry, status } : entry,
        ),
      )
      setPokemonDetail((current) =>
        current
          ? {
              ...current,
              status:
                current.canonicalKey === canonicalKey ? status : current.status,
              forms: current.forms.map((form) =>
                form.key === canonicalKey ? { ...form, status } : form,
              ),
            }
          : current,
      )
    },
    [],
  )

  const mutateCollection = useCallback(
    async (
      canonicalKey: string,
      previousState: CollectionState,
      targetState: CollectionState,
      mutation: () => ReturnType<typeof advanceCollection>,
    ) => {
      if (mutatingKey === canonicalKey || previousState === targetState) return
      setCollectionError(null)
      setMutatingKey(canonicalKey)
      applyCollectionState(canonicalKey, targetState)
      try {
        const authoritative = await mutation()
        applyCollectionState(canonicalKey, authoritative.state)
        refreshCollectionSummary()
      } catch {
        applyCollectionState(canonicalKey, previousState)
        setCollectionError("Collection update failed. Your previous status was restored.")
      } finally {
        setMutatingKey(null)
      }
    },
    [applyCollectionState, mutatingKey, refreshCollectionSummary],
  )

  const advanceStatus = useCallback(
    (canonicalKey: string, currentState: CollectionState) => {
      const targetState =
        currentState === "unseen"
          ? "seen"
          : currentState === "seen"
            ? "owned"
            : "owned"
      void mutateCollection(canonicalKey, currentState, targetState, () =>
        advanceCollection(canonicalKey),
      )
    },
    [mutateCollection],
  )

  const setStatus = useCallback(
    (canonicalKey: string, targetState: CollectionState) => {
      const previousState =
        pokemonDetail?.canonicalKey === canonicalKey
          ? pokemonDetail.status
          : "unseen"
      void mutateCollection(canonicalKey, previousState, targetState, () =>
        setCollectionState(canonicalKey, targetState),
      )
    },
    [mutateCollection, pokemonDetail],
  )

  const areaCompletion = useMemo(() => {
    const selected = zones.find((zone) => zone.id === selectedPlaceId)
    if (!selected) return undefined
    const encounters = sosMode
      ? [...selected.sosEncounters, ...selected.additionalSosEncounters]
      : selected.encounters
    const unique = new Map(encounters.map((pokemon) => [pokemon.canonicalKey, pokemon]))
    const values = [...unique.values()]
    return {
      total: values.length,
      seen: values.filter((pokemon) => pokemon.status === "seen").length,
      owned: values.filter((pokemon) => pokemon.status === "owned").length,
    }
  }, [selectedPlaceId, sosMode, zones])

  const visiblePokedexEntries = useMemo(
    () =>
      pokedexFilter === "all"
        ? pokedexEntries
        : pokedexEntries.filter((entry) => entry.status === pokedexFilter),
    [pokedexEntries, pokedexFilter],
  )

  const pokedexCounts =
    pokedexSort === "alola"
      ? collectionSummary?.alola_species_counts
      : collectionSummary?.national_species_counts

  const currentLocationIndex =
    route.view === "areas"
      ? locations.findIndex(
          (location) => location.location_key === route.locationKey,
        )
      : -1
  const goToLocationAt = (index: number) => {
    if (route.view !== "areas" || !route.groupKey || !locations[index]) return
    navigate({
      view: "areas",
      groupKey: route.groupKey,
      locationKey: locations[index].location_key,
    })
  }

  const areasState: ResourceState =
    groupsState === "error" ||
    locationsState === "error" ||
    locationState === "error"
      ? "error"
      : groupsState === "loading" ||
          locationsState === "loading" ||
          locationState === "loading"
        ? "loading"
        : zones.length
          ? "ready"
          : "empty"

  const connectionLabel = health
    ? `API connected · ${health.database.replace("_", " ")}`
    : healthError
      ? "API unavailable"
      : "Checking API"

  const navigateTab = (view: AppRoute["view"]) => {
    if (view === "areas") navigate(lastAreaRoute)
    else if (view === "pokemon")
      navigate({ view: "pokemon", canonicalKey: null })
    else navigate({ view: "pokedex" })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-bg)]">
      <div className="min-h-0 flex-1 overflow-hidden">
        {route.view === "areas" && (
          <AreasView
            islands={islands}
            activeIslandId={route.groupKey}
            locations={locationOptions}
            selectedLocationId={route.locationKey}
            map={islandMap}
            zones={zones}
            completion={areaCompletion}
            selectedZoneId={selectedPlaceId}
            state={areasState}
            timeOfDay={timeOfDay}
            sosMode={sosMode}
            onSelectIsland={(groupKey) =>
              navigate({ view: "areas", groupKey, locationKey: null })
            }
            onSelectLocation={(locationKey) =>
              route.groupKey &&
              navigate({ view: "areas", groupKey: route.groupKey, locationKey })
            }
            onSelectZone={setSelectedPlaceId}
            onTimeOfDayChange={setTimeOfDay}
            onSosModeChange={setSosMode}
            onPreviousLocation={
              currentLocationIndex > 0
                ? () => goToLocationAt(currentLocationIndex - 1)
                : undefined
            }
            onNextLocation={
              currentLocationIndex >= 0 &&
              currentLocationIndex < locations.length - 1
                ? () => goToLocationAt(currentLocationIndex + 1)
                : undefined
            }
            onPokemonSelect={(pokemon) =>
              navigate({ view: "pokemon", canonicalKey: pokemon.canonicalKey })
            }
            onStatusAction={advanceStatus}
            mappingInProgress={mappingInProgress}
            onRetry={() => setAreasReloadKey((current) => current + 1)}
          />
        )}
        {route.view === "pokemon" && (
          <PokemonSearch
            query={searchQuery}
            results={searchResults}
            state={searchState}
            onQueryChange={setSearchQuery}
            onPokemonSelect={(canonicalKey) =>
              navigate({ view: "pokemon", canonicalKey })
            }
          />
        )}
        {route.view === "pokedex" && (
          <PokedexView
            entries={visiblePokedexEntries}
            state={pokedexState}
            sort={pokedexSort}
            filter={pokedexFilter}
            query={pokedexQuery}
            generation={pokedexGeneration}
            trackingEnabled
            totalCount={pokedexCounts?.total ?? pokedexEntries.length}
            seenCount={
              pokedexCounts
                ? pokedexCounts.seen + pokedexCounts.owned
                : pokedexEntries.filter((entry) => entry.status !== "unseen").length
            }
            ownedCount={
              pokedexCounts?.owned ??
              pokedexEntries.filter((entry) => entry.status === "owned").length
            }
            onSortChange={setPokedexSort}
            onFilterChange={setPokedexFilter}
            onQueryChange={setPokedexQuery}
            onGenerationChange={setPokedexGeneration}
            onPokemonSelect={(pokemon) =>
              navigate({ view: "pokemon", canonicalKey: pokemon.canonicalKey })
            }
          />
        )}
      </div>

      {collectionError && (
        <div
          className="fixed bottom-16 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-[var(--color-danger)] px-4 py-2 text-xs font-black text-white shadow-xl"
          role="alert"
        >
          {collectionError}
        </div>
      )}

      <nav
        className="flex flex-shrink-0 items-stretch border-t border-[var(--color-border)] bg-[var(--color-surface)]"
        aria-label="Primary navigation"
      >
        {TABS.map((item) => (
          <button
            key={item.key}
            className={`flex flex-1 flex-col items-center gap-0.5 px-2 py-2.5 transition-colors ${
              route.view === item.key
                ? "text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            type="button"
            onClick={() => navigateTab(item.key)}
            aria-current={route.view === item.key ? "page" : undefined}
          >
            <svg
              className={`h-5 w-5 ${
                route.view === item.key ? "scale-110" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={route.view === item.key ? 2.5 : 1.8}
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
                route.view === item.key ? "text-[var(--color-accent)]" : ""
              }`}
            >
              {item.label}
            </span>
            {route.view === item.key && (
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
        open={selectedCanonicalKey != null}
        pokemon={pokemonDetail}
        state={pokemonDetailState}
        onClose={() => navigate({ view: "pokemon", canonicalKey: null })}
        onSelectForm={(canonicalKey) =>
          navigate({ view: "pokemon", canonicalKey })
        }
        onGoToLocation={(groupKey, locationKey) =>
          navigate({ view: "areas", groupKey, locationKey })
        }
        onSetStatus={setStatus}
        mutationPending={mutatingKey === selectedCanonicalKey}
      />
    </div>
  )
}
