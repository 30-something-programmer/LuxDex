import type {
  PokemonCardModel,
  PokemonSearchResultModel,
  ResourceState,
} from "../types/presentation"
import { formatLevelRange, formatSlots } from "../lib/format"
import PokemonArtwork, { PokeBallIcon, SeenIcon } from "./PokemonArtwork"

interface PokemonSearchProps {
  query: string
  results: PokemonSearchResultModel[]
  state: ResourceState
  onQueryChange: (query: string) => void
  onPokemonSelect?: (pokemon: PokemonCardModel) => void
  onGoToLocation?: (locationId: string) => void
}

function ResultStatus({ pokemon }: { pokemon: PokemonCardModel }) {
  if (pokemon.status === "owned") return <PokeBallIcon className="h-5 w-5" />
  if (pokemon.status === "seen")
    return <SeenIcon className="h-5 w-5 text-[var(--color-seen)]" />
  return (
    <span
      className="h-3 w-3 rounded-full border-2 border-[var(--color-text-muted)] opacity-45"
      aria-hidden="true"
    />
  )
}

export default function PokemonSearch({
  query,
  results,
  state,
  onQueryChange,
  onPokemonSelect,
  onGoToLocation,
}: PokemonSearchProps) {
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Encounter lookup
          </p>
          <h2 className="mt-0.5 text-xl font-black text-[var(--color-text)] sm:text-2xl">
            Pokémon Finder
          </h2>
          <label className="relative mt-3 block">
            <svg
              className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-muted)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.8-3.8" />
            </svg>
            <span className="sr-only">Search Pokémon</span>
            <input
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] py-3 pl-11 pr-4 text-sm font-bold text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search by Pokémon name…"
              autoComplete="off"
            />
          </label>
        </div>
      </header>

      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        {state === "loading" && results.length === 0 ? (
          <div className="space-y-3" aria-label="Loading Pokémon results">
            {[0, 1, 2].map((key) => (
              <div
                key={key}
                className="h-36 animate-pulse rounded-2xl bg-[var(--color-panel)]"
              />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-panel)]/35 p-8 text-center">
            <div>
              <div
                className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-accent-soft)] text-2xl text-[var(--color-accent)]"
                aria-hidden="true"
              >
                ⌕
              </div>
              <h3 className="font-black text-[var(--color-text)]">
                {state === "error"
                  ? "Pokémon search is unavailable"
                  : query
                    ? "No matching Pokémon"
                    : "Search shell ready"}
              </h3>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text-muted)]">
                {state === "error"
                  ? "The data service could not be reached."
                  : "Results will appear here when the API provides encounter records."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map(({ pokemon, occurrences }) => (
              <article
                key={pokemon.id}
                className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]"
              >
                <div className="flex items-center gap-3 border-b border-[var(--color-border)] p-3 sm:p-4">
                  <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-xl bg-[var(--color-surface)]">
                    <PokemonArtwork
                      name={pokemon.name}
                      spriteAssetKey={pokemon.spriteAssetKey}
                      status={pokemon.status}
                      className="h-12 w-12"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-black text-[var(--color-text)]">
                      {pokemon.name}
                    </h3>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold capitalize text-[var(--color-text-muted)]">
                      <ResultStatus pokemon={pokemon} /> {pokemon.status}
                    </div>
                  </div>
                  {onPokemonSelect && (
                    <button
                      className="rounded-xl bg-[var(--color-accent-soft)] px-3 py-2 text-xs font-black text-[var(--color-accent)]"
                      type="button"
                      onClick={() => onPokemonSelect(pokemon)}
                    >
                      Details
                    </button>
                  )}
                </div>

                {occurrences.length === 0 ? (
                  <div className="px-4 py-5 text-center text-xs font-semibold text-[var(--color-text-muted)]">
                    No encounter locations supplied
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--color-border)]">
                    {occurrences.map((occurrence) => (
                      <button
                        key={occurrence.id}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-panel-hover)] disabled:cursor-default"
                        type="button"
                        onClick={() => onGoToLocation?.(occurrence.locationId)}
                        disabled={!onGoToLocation}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-black text-[var(--color-text)]">
                            {occurrence.locationName}
                          </div>
                          <div className="truncate text-[10px] font-semibold text-[var(--color-text-muted)]">
                            {occurrence.zoneLabel}
                          </div>
                        </div>
                        <span className="hidden rounded-lg bg-[var(--color-surface)] px-2 py-1 text-[10px] font-bold text-[var(--color-text-muted)] [font-family:var(--font-mono)] sm:block">
                          {formatLevelRange(
                            occurrence.minLevel,
                            occurrence.maxLevel,
                          )}
                        </span>
                        {occurrence.sosSlots?.length ? (
                          <span className="rounded-lg bg-[var(--color-sos)]/15 px-2 py-1 text-[10px] font-black text-[var(--color-sos)]">
                            SOS {formatSlots(occurrence.sosSlots)}
                          </span>
                        ) : null}
                        <span
                          className={`rounded-lg px-2 py-1 text-[10px] font-black ${
                            occurrence.timeOfDay === "night"
                              ? "bg-[var(--color-night)]/15 text-[var(--color-night)]"
                              : "bg-[var(--color-owned)]/15 text-[var(--color-owned)]"
                          }`}
                        >
                          {occurrence.timeOfDay === "both"
                            ? "Day / Night"
                            : occurrence.timeOfDay === "day"
                              ? "Day"
                              : "Night"}
                        </span>
                        <span className="w-10 text-right text-xs font-black text-[var(--color-accent)] [font-family:var(--font-mono)]">
                          {occurrence.rate}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
