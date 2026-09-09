import type {
  PokemonSearchResultModel,
  ResourceState,
} from "../types/presentation"
import PokemonArtwork from "./PokemonArtwork"

interface PokemonSearchProps {
  query: string
  results: PokemonSearchResultModel[]
  state: ResourceState
  onQueryChange: (query: string) => void
  onPokemonSelect: (canonicalKey: string) => void
}

export default function PokemonSearch({
  query,
  results,
  state,
  onQueryChange,
  onPokemonSelect,
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
              placeholder="Search by Pokémon or form name…"
              autoComplete="off"
            />
          </label>
        </div>
      </header>

      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        {state === "loading" ? (
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            aria-label="Loading Pokémon results"
          >
            {[0, 1, 2, 3].map((key) => (
              <div
                key={key}
                className="h-24 animate-pulse rounded-2xl bg-[var(--color-panel)]"
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
                  : query.trim()
                    ? "No matching Pokémon"
                    : "Find a Pokémon"}
              </h3>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text-muted)]">
                {state === "error"
                  ? "Unable to load Pokémon data."
                  : query.trim()
                    ? "Try another canonical name or form."
                    : "Search the canonical Pokédex, then see where it appears in Penumbra."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {results.map(
              ({ pokemon, nationalDexNumber, alolaDexNumber, generation }) => (
                <button
                  key={pokemon.canonicalKey}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-3 text-left transition-transform hover:-translate-y-0.5 hover:bg-[var(--color-panel-hover)]"
                  type="button"
                  onClick={() => onPokemonSelect(pokemon.canonicalKey)}
                >
                  <span className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-xl bg-[var(--color-surface)]">
                    <PokemonArtwork
                      name={pokemon.name}
                      spritePath={pokemon.spritePath}
                      status="untracked"
                      className="h-14 w-14"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-[var(--color-text)]">
                      {pokemon.name}
                    </span>
                    {pokemon.formLabel &&
                      pokemon.formLabel !== pokemon.name && (
                        <span className="block truncate text-[10px] font-bold text-[var(--color-accent)]">
                          {pokemon.formLabel}
                        </span>
                      )}
                    <span className="mt-1 block text-[10px] font-semibold text-[var(--color-text-muted)] [font-family:var(--font-mono)]">
                      #{String(nationalDexNumber).padStart(3, "0")}
                      {alolaDexNumber != null
                        ? ` · Alola ${String(alolaDexNumber).padStart(3, "0")}`
                        : ""}
                      {` · Gen ${generation}`}
                    </span>
                    <span className="mt-1 block text-[10px] font-black text-[var(--color-accent)]">
                      Find in Penumbra →
                    </span>
                  </span>
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  )
}
