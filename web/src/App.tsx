import { useCallback, useEffect, useMemo, useState } from "react"
import { getHealth } from "./api/client"
import {
  advanceCollection,
  getCollectionSummary,
  setCollectionStates,
  setCollectionState,
} from "./api/collection"
import { getMapStudio } from "./api/mapStudio"
import { getLocationExplore, getPokemonExplore } from "./api/explore"
import { getAreaGroups, getLocations } from "./api/geography"
import { listPokemon } from "./api/pokemon"
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
import MapStudio from "./components/MapStudio"
import IslandTabs from "./components/IslandTabs"
import { parseRoute, routePath, type AppRoute } from "./lib/routing"
import {
  toEncounterZones,
  toIslandOptions,
  toLocationOptions,
  toPokedexEntries,
  toPokemonDetail,
} from "./presentation/adapters"
import { buildIslandMap } from "./presentation/islandMaps"
import type {
  PokedexEntryModel,
  PokedexSort,
  PokemonDetailModel,
  ResourceState,
  StatusFilter,
  TimeOfDay,
} from "./types/presentation"

type Theme = "dark" | "light"

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
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("day")
  const [areasReloadKey, setAreasReloadKey] = useState(0)

  const [studioNodes, setStudioNodes] =
    useState<import("./api/types").StudioNodeResponse[]>([])
  const [profileOpen, setProfileOpen] = useState(false)
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
        if (!isAbort(error))
          setCollectionError("Collection progress is unavailable.")
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
      return
    }
    const controller = new AbortController()
    setLocationExplore(null)
    setLocationState("loading")
    getLocationExplore(route.groupKey, route.locationKey, controller.signal)
      .then((response) => {
        setLocationExplore(response)
        setLocationState(response.places.length ? "ready" : "empty")
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
    const controller = new AbortController()
    getMapStudio(controller.signal)
      .then((document) => setStudioNodes(document.nodes))
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

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
    if (route.view !== "pokedex" && route.view !== "pokemon") return
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
        setCollectionError(
          "Collection update failed. Your previous status was restored.",
        )
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

  const markOwned = useCallback(
    (canonicalKey: string, currentState: CollectionState) => {
      void mutateCollection(canonicalKey, currentState, "owned", () =>
        setCollectionState(canonicalKey, "owned"),
      )
    },
    [mutateCollection],
  )

  const bulkSetStatus = useCallback(
    async (
      canonicalKeys: string[],
      state: CollectionState,
      preserveOwned = false,
    ) => {
      try {
        const rows = await setCollectionStates(
          canonicalKeys,
          state,
          preserveOwned,
        )
        rows.forEach((row) =>
          applyCollectionState(row.canonical_key, row.state),
        )
        refreshCollectionSummary()
      } catch {
        setCollectionError("Bulk collection update failed.")
      }
    },
    [applyCollectionState, refreshCollectionSummary],
  )

  const areaCompletion = useMemo(() => {
    if (zones.length === 0) return undefined
    const encounters = zones.flatMap((zone) => [
      ...zone.encounters,
      ...zone.sosEncounters,
      ...zone.additionalSosEncounters,
    ])
    const unique = new Map(
      encounters.map((pokemon) => [pokemon.canonicalKey, pokemon]),
    )
    const values = [...unique.values()]
    return {
      total: values.length,
      seen: values.filter((pokemon) => pokemon.status === "seen").length,
      owned: values.filter((pokemon) => pokemon.status === "owned").length,
    }
  }, [zones])

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

  const mapRegions = studioNodes
    .filter((node) => node.node_type === "location" && node.geometry)
    .map((node) => ({
      locationKey: node.canonical_key!,
      points: node.geometry!,
    }))

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-bg)]">
      <header
        className="relative flex min-h-14 flex-shrink-0 items-stretch border-b border-[var(--color-border)] bg-[var(--color-surface)]"
        aria-label="Application navigation"
      >
        <button
          className="grid w-12 place-items-center border-r border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-melemele)]"
          type="button"
          onClick={() => navigate(lastAreaRoute)}
          aria-label="Home: return to last selected map"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m3 11 9-8 9 8v10h-6v-6H9v6H3Z" />
          </svg>
        </button>
        <button
          className={`flex items-center border-r border-[var(--color-border)] px-3 text-[10px] font-black tracking-widest ${
            route.view === "studio"
              ? "bg-[var(--color-sos)] text-white"
              : "text-[var(--color-sos)]"
          }`}
          type="button"
          onClick={() => navigate({ view: "studio" })}
        >
          MAP STUDIO
        </button>
        <div className="min-w-0 flex-1 overflow-hidden">
          <IslandTabs
            islands={islands}
            activeIslandId={route.view === "areas" ? route.groupKey : null}
            state={groupsState}
            onSelect={(groupKey) =>
              navigate({ view: "areas", groupKey, locationKey: null })
            }
          />
        </div>
        <button
          className={`flex items-center gap-2 px-3 text-xs font-black ${
            route.view === "pokedex" || route.view === "pokemon"
              ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
              : "text-[var(--color-text)]"
          }`}
          type="button"
          onClick={() => navigate({ view: "pokedex" })}
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 6v14m0-14C9 4 6 4 3 6v14c3-2 6-2 9 0m0-14c3-2 6-2 9 0v14c-3-2-6-2-9 0" />
          </svg>
          <span className="hidden sm:inline">Pokédex</span>
        </button>
        <button
          className="relative grid w-12 place-items-center text-[var(--color-text-muted)]"
          type="button"
          onClick={() => setProfileOpen((value) => !value)}
          aria-label="Profile"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1-5 4-7 8-7s7 2 8 7" />
          </svg>
        </button>
        <button
          className="relative grid w-12 place-items-center border-l border-[var(--color-border)] text-[var(--color-text-muted)]"
          type="button"
          onClick={() =>
            setTheme((value) => (value === "dark" ? "light" : "dark"))
          }
          aria-label={`${
            theme === "dark" ? "Use light theme" : "Use dark theme"
          }. ${connectionLabel}`}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          <span
            className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${
              health
                ? "bg-[var(--color-success)]"
                : healthError
                  ? "bg-[var(--color-danger)]"
                  : "bg-[var(--color-accent)]"
            }`}
          />
        </button>
        {profileOpen && (
          <div className="absolute right-12 top-[calc(100%+.5rem)] z-50 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xl">
            <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">
              Current profile
            </p>
            <p className="font-black">Local Player</p>
            <button
              className="mt-3 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-bold opacity-60"
              disabled
            >
              Create profile · coming later
            </button>
          </div>
        )}
      </header>
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
            state={areasState}
            timeOfDay={timeOfDay}
            mapRegions={mapRegions}
            onSelectLocation={(locationKey) =>
              route.groupKey &&
              navigate({ view: "areas", groupKey: route.groupKey, locationKey })
            }
            onTimeOfDayChange={setTimeOfDay}
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
            onMarkSeen={advanceStatus}
            onMarkOwned={markOwned}
            mappingInProgress={mappingInProgress}
            onRetry={() => setAreasReloadKey((current) => current + 1)}
            onBulk={bulkSetStatus}
          />
        )}
        {(route.view === "pokedex" || route.view === "pokemon") && (
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
                : pokedexEntries.filter((entry) => entry.status !== "unseen")
                    .length
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
        {route.view === "studio" && (
          <MapStudio
            onDocumentChange={(document) => setStudioNodes(document.nodes)}
            onCollectionChange={(canonicalKey, state) =>
              void setCollectionState(canonicalKey, state).then((row) =>
                applyCollectionState(row.canonical_key, row.state),
              )
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

      <PokePanel
        open={selectedCanonicalKey != null}
        pokemon={pokemonDetail}
        state={pokemonDetailState}
        onClose={() => navigate({ view: "pokedex" })}
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
