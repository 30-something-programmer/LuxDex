import type {
  EncounterZoneModel,
  PokemonCardModel,
  PokemonStatus,
  ResourceState,
} from "../types/presentation"
import { useState } from "react"
import { formatLevelRange } from "../lib/format"
import {
  environmentClassName,
  environmentStyleFor,
} from "../presentation/environments"
import PokeTile from "./PokeTile"

interface EncounterZoneCardsProps {
  zones: EncounterZoneModel[]
  state: ResourceState
  onPokemonSelect?: (pokemon: PokemonCardModel) => void
  onMarkSeen?: (canonicalKey: string, status: PokemonStatus) => void
  onMarkOwned?: (canonicalKey: string, status: PokemonStatus) => void
  onRetry?: () => void
  emptyMessage?: string
  onBulk?: (
    canonicalKeys: string[],
    state: PokemonStatus,
    preserveOwned?: boolean,
  ) => void
}
export default function EncounterZoneCards({
  zones,
  state,
  onPokemonSelect,
  onMarkSeen,
  onMarkOwned,
  onRetry,
  emptyMessage,
  onBulk,
}: EncounterZoneCardsProps) {
  const [sosZones, setSosZones] = useState<Record<string, boolean>>({})
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
        const sosMode = Boolean(sosZones[zone.id])
        const encounters = sosMode
          ? [...zone.sosEncounters, ...zone.additionalSosEncounters]
          : zone.encounters
        const levelRange = formatLevelRange(zone.minLevel, zone.maxLevel)
        const environmentClass = environmentClassName(
          environmentStyleFor(zone.method, zone.label),
        )
        const allKeys = [
          ...new Set(
            [
              ...zone.encounters,
              ...zone.sosEncounters,
              ...zone.additionalSosEncounters,
            ].map((pokemon) => pokemon.canonicalKey),
          ),
        ]
        return (
          <section
            key={zone.id}
            className={`overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] ${environmentClass}`}
          >
            <div
              className={`flex items-center gap-2 border-b border-[var(--color-border)]/70 px-3 py-2.5 ${
                sosMode ? "bg-[var(--color-sos)]/10" : ""
              }`}
            >
              <h3 className="text-xs font-black text-[var(--color-text)]">
                {zone.label}
              </h3>
              {levelRange && (
                <span className="rounded-lg bg-[var(--color-surface)]/80 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)] [font-family:var(--font-mono)]">
                  {levelRange}
                </span>
              )}
              <div className="ml-auto flex flex-wrap justify-end gap-1">
                {zone.sosEncounters.length +
                  zone.additionalSosEncounters.length >
                  0 && (
                  <button
                    type="button"
                    className={`rounded-lg px-2 py-1 text-[10px] font-black ${
                      sosMode
                        ? "bg-[var(--color-sos)] text-white"
                        : "bg-[var(--color-surface)] text-[var(--color-sos)]"
                    }`}
                    aria-pressed={sosMode}
                    onClick={() =>
                      setSosZones((current) => ({
                        ...current,
                        [zone.id]: !sosMode,
                      }))
                    }
                  >
                    {sosMode ? "SOS" : "Normal · SOS"}
                  </button>
                )}
                {onBulk && (
                  <>
                    <button
                      type="button"
                      className="rounded-lg bg-black/25 px-2 py-1 text-[10px] font-bold"
                      onClick={() => onBulk(allKeys, "seen", true)}
                    >
                      Seen All
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-black/25 px-2 py-1 text-[10px] font-bold"
                      onClick={() => onBulk(allKeys, "owned")}
                    >
                      Captured All
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-black/25 px-2 py-1 text-[10px] font-bold text-[var(--color-danger)]"
                      onClick={() =>
                        window.confirm(
                          `Reset collection state for ${zone.label}?`,
                        ) && onBulk(allKeys, "unseen")
                      }
                    >
                      Reset
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="p-2">
              {encounters.length === 0 ? (
                <div className="py-7 text-center text-xs font-semibold text-[var(--color-text-muted)]">
                  No {sosMode ? "SOS " : ""}encounters in this zone
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
                  {encounters.map((pokemon) => (
                    <PokeTile
                      key={pokemon.id}
                      pokemon={pokemon}
                      onSelect={onPokemonSelect}
                      onMarkSeen={onMarkSeen}
                      onMarkOwned={onMarkOwned}
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
