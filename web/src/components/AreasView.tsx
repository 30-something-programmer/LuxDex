import { useEffect, useState } from "react"
import type {
  AreaCompletionModel,
  EncounterZoneModel,
  IslandMapModel,
  IslandOption,
  LocationOption,
  PokemonCardModel,
  PokemonStatus,
  ResourceState,
  TimeOfDay,
} from "../types/presentation"
import DayNightControl from "./DayNightControl"
import EncounterZoneCards from "./EncounterZoneCards"
import Sidebar from "./Sidebar"
import type { MapRegion } from "./maps/MelemeleMap"

interface AreasViewProps {
  islands: IslandOption[]
  activeIslandId: string | null
  locations: LocationOption[]
  selectedLocationId: string | null
  map: IslandMapModel | null
  zones: EncounterZoneModel[]
  completion?: AreaCompletionModel
  state: ResourceState
  timeOfDay: TimeOfDay
  mapRegions?: MapRegion[]
  onSelectLocation: (locationId: string) => void
  onTimeOfDayChange: (timeOfDay: TimeOfDay) => void
  onPreviousLocation?: () => void
  onNextLocation?: () => void
  onPokemonSelect?: (pokemon: PokemonCardModel) => void
  onMarkSeen?: (canonicalKey: string, status: PokemonStatus) => void
  onMarkOwned?: (canonicalKey: string, status: PokemonStatus) => void
  mappingInProgress?: boolean
  onRetry?: () => void
  onBulk?: (
    canonicalKeys: string[],
    state: PokemonStatus,
    preserveOwned?: boolean,
  ) => void
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  )
}

export default function AreasView({
  islands,
  activeIslandId,
  locations,
  selectedLocationId,
  map,
  zones,
  completion,
  state,
  timeOfDay,
  mapRegions = [],
  onSelectLocation,
  onTimeOfDayChange,
  onPreviousLocation,
  onNextLocation,
  onPokemonSelect,
  onMarkSeen,
  onMarkOwned,
  mappingInProgress = false,
  onRetry,
  onBulk,
}: AreasViewProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const activeIsland =
    islands.find((island) => island.id === activeIslandId) ?? null
  const selectedLocation =
    locations.find((location) => location.id === selectedLocationId) ?? null
  const accentColor = activeIsland?.color ?? "var(--color-accent)"
  const sidebarTitle = activeIsland?.fullName ?? "Island navigation"

  useEffect(() => {
    if (!mobileNavigationOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavigationOpen(false)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [mobileNavigationOpen])

  const sidebar = (
    <Sidebar
      title={sidebarTitle}
      accentColor={accentColor}
      groupKey={activeIslandId}
      map={map}
      locations={locations}
      selectedLocationId={selectedLocationId}
      state={state}
      onSelectLocation={onSelectLocation}
      onClose={() => setMobileNavigationOpen(false)}
      emptyMessage={
        mappingInProgress
          ? "Locations will appear as mapping is verified."
          : undefined
      }
      mapRegions={mapRegions}
    />
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 flex-shrink-0 border-r border-[var(--color-border)] lg:block">
          {sidebar}
        </aside>

        {mobileNavigationOpen && (
          <div
            className="fixed inset-0 z-40 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Location navigation"
          >
            <button
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              type="button"
              aria-label="Close location navigation"
              onClick={() => setMobileNavigationOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-[min(20rem,88vw)] border-r border-[var(--color-border)] shadow-2xl">
              {sidebar}
            </aside>
          </div>
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex flex-shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 sm:px-4">
            <button
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-[var(--color-panel)] text-[var(--color-text)] lg:hidden"
              type="button"
              onClick={() => setMobileNavigationOpen(true)}
              aria-label="Open island map and location navigation"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
                <path d="M9 3v15m6-12v15" />
              </svg>
            </button>

            <button
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-[var(--color-panel)] text-[var(--color-text-muted)] enabled:hover:text-[var(--color-text)] disabled:opacity-35"
              type="button"
              onClick={onPreviousLocation}
              disabled={!onPreviousLocation}
              aria-label="Previous location"
            >
              <ArrowIcon direction="left" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                {activeIsland ? activeIsland.fullName : "Areas"}
                {selectedLocation?.secondaryLabel
                  ? ` / ${selectedLocation.secondaryLabel}`
                  : ""}
              </div>
              <h2 className="truncate text-base font-black leading-tight text-[var(--color-text)] sm:text-lg">
                {selectedLocation?.name ??
                  (state === "loading"
                    ? "Loading locations…"
                    : "Select a location")}
              </h2>
            </div>

            <button
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-[var(--color-panel)] text-[var(--color-text-muted)] enabled:hover:text-[var(--color-text)] disabled:opacity-35"
              type="button"
              onClick={onNextLocation}
              disabled={!onNextLocation}
              aria-label="Next location"
            >
              <ArrowIcon direction="right" />
            </button>
          </header>

          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-panel)]/45 px-3 py-2 sm:px-4">
            <DayNightControl value={timeOfDay} onChange={onTimeOfDayChange} />
            {onBulk && zones.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <button
                  className="rounded-lg bg-[var(--color-panel)] px-2 py-1 text-[10px] font-bold"
                  onClick={() =>
                    onBulk(
                      [
                        ...new Set(
                          zones
                            .flatMap((zone) => [
                              ...zone.encounters,
                              ...zone.sosEncounters,
                              ...zone.additionalSosEncounters,
                            ])
                            .map((pokemon) => pokemon.canonicalKey),
                        ),
                      ],
                      "seen",
                      true,
                    )
                  }
                >
                  Location Seen All
                </button>
                <button
                  className="rounded-lg bg-[var(--color-panel)] px-2 py-1 text-[10px] font-bold"
                  onClick={() =>
                    onBulk(
                      [
                        ...new Set(
                          zones
                            .flatMap((zone) => [
                              ...zone.encounters,
                              ...zone.sosEncounters,
                              ...zone.additionalSosEncounters,
                            ])
                            .map((pokemon) => pokemon.canonicalKey),
                        ),
                      ],
                      "owned",
                    )
                  }
                >
                  Location Captured All
                </button>
                <button
                  className="rounded-lg bg-[var(--color-panel)] px-2 py-1 text-[10px] font-bold text-[var(--color-danger)]"
                  onClick={() =>
                    window.confirm(
                      "Reset all Pokémon in this location to Unseen?",
                    ) &&
                    onBulk(
                      [
                        ...new Set(
                          zones
                            .flatMap((zone) => [
                              ...zone.encounters,
                              ...zone.sosEncounters,
                              ...zone.additionalSosEncounters,
                            ])
                            .map((pokemon) => pokemon.canonicalKey),
                        ),
                      ],
                      "unseen",
                    )
                  }
                >
                  Location Reset
                </button>
              </div>
            )}
            {completion && completion.total > 0 ? (
              <div
                className="ml-auto flex items-center gap-2"
                aria-label={`${completion.owned} captured, ${completion.seen + completion.owned} seen, ${completion.total} total`}
              >
                <div
                  className="hidden max-w-28 flex-wrap gap-0.5 sm:flex"
                  aria-hidden="true"
                >
                  {Array.from(
                    { length: Math.min(completion.total, 14) },
                    (_, index) => (
                      <span
                        key={index}
                        className={`h-2.5 w-2.5 rounded-full ${
                          index < completion.owned
                            ? "bg-[var(--color-owned)]"
                            : index < completion.owned + completion.seen
                              ? "bg-[var(--color-seen)]"
                              : "bg-[var(--color-border)]"
                        }`}
                      />
                    ),
                  )}
                </div>
                <span className="text-[10px] font-bold text-[var(--color-text-muted)]">
                  <span className="text-[var(--color-owned)]">
                    {completion.owned} captured
                  </span>
                  <span className="text-[var(--color-seen)]">
                    {" "}
                    · {completion.seen + completion.owned} seen
                  </span>
                  <span> / {completion.total} total</span>
                </span>
              </div>
            ) : (
              <span className="ml-auto hidden text-[10px] font-semibold text-[var(--color-text-muted)] sm:block">
                Encounter filters
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            <EncounterZoneCards
              zones={zones}
              state={state}
              onPokemonSelect={onPokemonSelect}
              onMarkSeen={onMarkSeen}
              onMarkOwned={onMarkOwned}
              onRetry={onRetry}
              emptyMessage={
                mappingInProgress
                  ? `Some encounter areas on ${activeIsland?.fullName ?? "this island"} are still being mapped. Verified locations will appear here without placeholder data.`
                  : undefined
              }
              onBulk={onBulk}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
