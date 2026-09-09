import type {
  EncounterZoneModel,
  PokemonCardModel,
  PokemonStatus,
  ResourceState,
} from "../types/presentation"
import { formatLevelRange } from "../lib/format"
import PokeTile from "./PokeTile"

interface EncounterZoneCardsProps {
  zones: EncounterZoneModel[]
  sosMode: boolean
  state: ResourceState
  onPokemonSelect?: (pokemon: PokemonCardModel) => void
  onStatusAction?: (canonicalKey: string, status: PokemonStatus) => void
  onRetry?: () => void
  emptyMessage?: string
}
export default function EncounterZoneCards({
  zones,
  sosMode,
  state,
  onPokemonSelect,
  onStatusAction,
  onRetry,
  emptyMessage,
}: EncounterZoneCardsProps) {
  if (state === "loading" && zones.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1].map((zone) => (
          <div
            key={zone}
            className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]"
          >
            <div className="h-10 animate-pulse border-b border-[var(--color-border)] bg-[var(--color-surface)]" />
            <div className="grid grid-cols-3 gap-2 p-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
              {[0, 1, 2, 3, 4, 5].map((tile) => (
                <div
                  key={tile}
                  className="h-24 animate-pulse rounded-xl bg-[var(--color-surface)]"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (zones.length === 0) {
    return (
      <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-panel)]/35 p-6 text-center">
        <div>
          <div className="mb-2 text-3xl" aria-hidden="true">
            ◌
          </div>
          <div className="text-sm font-bold text-[var(--color-text)]">
            {state === "error"
              ? "Encounter data is unavailable"
              : "No encounter areas loaded"}
          </div>
          <div className="mt-1 text-xs font-semibold text-[var(--color-text-muted)]">
            {state === "error"
              ? "Unable to load location data."
              : (emptyMessage ??
                "No verified encounter places are currently mapped for this location.")}
          </div>
          {state === "error" && onRetry && (
            <button
              className="mt-4 min-h-9 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-black text-white"
              type="button"
              onClick={onRetry}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {zones.map((zone) => {
        const encounters = sosMode
          ? [...zone.sosEncounters, ...zone.additionalSosEncounters]
          : zone.encounters
        const levelRange = formatLevelRange(zone.minLevel, zone.maxLevel)
        return (
          <section
            key={zone.id}
            className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]"
          >
            <div
              className={`flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5 ${
                sosMode ? "bg-[var(--color-sos)]/10" : ""
              }`}
            >
              <h3 className="text-xs font-black text-[var(--color-text)]">
                {zone.label}
              </h3>
              {levelRange && (
                <span className="rounded-lg bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)] [font-family:var(--font-mono)]">
                  {levelRange}
                </span>
              )}
              {sosMode ? (
                <span className="ml-auto rounded-lg bg-[var(--color-sos)] px-2 py-0.5 text-[10px] font-black tracking-wide text-white">
                  SOS
                </span>
              ) : zone.sosEncounters.length > 0 ? (
                <span className="ml-auto text-[10px] font-semibold text-[var(--color-sos)] opacity-70">
                  SOS available
                </span>
              ) : null}
            </div>
            <div className="p-2">
              {encounters.length === 0 ? (
                <div className="py-7 text-center text-xs font-semibold text-[var(--color-text-muted)]">
                  No {sosMode ? "SOS " : ""}encounters in this zone
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                  {encounters.map((pokemon) => (
                    <PokeTile
                      key={pokemon.id}
                      pokemon={pokemon}
                      onSelect={onPokemonSelect}
                      onStatusAction={onStatusAction}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
