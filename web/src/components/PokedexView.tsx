import type {
  PokedexEntryModel,
  PokedexSort,
  ResourceState,
  StatusFilter,
} from "../types/presentation"
import PokemonArtwork, { PokeBallIcon, SeenIcon } from "./PokemonArtwork"

interface PokedexViewProps {
  entries: PokedexEntryModel[]
  state: ResourceState
  sort: PokedexSort
  filter: StatusFilter
  query: string
  generation: number | null
  trackingEnabled?: boolean
  totalCount?: number
  seenCount?: number
  ownedCount?: number
  onSortChange: (sort: PokedexSort) => void
  onFilterChange: (filter: StatusFilter) => void
  onQueryChange: (query: string) => void
  onGenerationChange: (generation: number | null) => void
  onPokemonSelect?: (pokemon: PokedexEntryModel) => void
}

interface SortOption {
  value: PokedexSort
  label: string
}

interface FilterOption {
  value: StatusFilter
  label: string
}

const sortOptions: SortOption[] = [
  { value: "alola", label: "Alola Dex" },
  { value: "national", label: "National" },
  { value: "az", label: "A–Z" },
]

const filterOptions: FilterOption[] = [
  { value: "all", label: "All" },
  { value: "unseen", label: "Unseen" },
  { value: "seen", label: "Seen" },
  { value: "owned", label: "Owned" },
]

function displayNumber(entry: PokedexEntryModel, sort: PokedexSort) {
  if (sort === "alola" && entry.alolaDexNumber != null)
    return `A-${String(entry.alolaDexNumber).padStart(3, "0")}`
  if (entry.nationalDexNumber != null)
    return `#${String(entry.nationalDexNumber).padStart(3, "0")}`
  return "—"
}

export default function PokedexView({
  entries,
  state,
  sort,
  filter,
  query,
  generation,
  trackingEnabled = true,
  totalCount = entries.length,
  seenCount = entries.filter((entry) => entry.status !== "unseen").length,
  ownedCount = entries.filter((entry) => entry.status === "owned").length,
  onSortChange,
  onFilterChange,
  onQueryChange,
  onGenerationChange,
  onPokemonSelect,
}: PokedexViewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-accent)]">
              Collection
            </p>
            <h2 className="text-xl font-black text-[var(--color-text)] sm:text-2xl">
              Pokédex
            </h2>
            <div className="mt-1 flex gap-3 text-xs font-bold [font-family:var(--font-mono)]">
              <span className="text-[var(--color-text-muted)]">
                {totalCount} total
              </span>
              {trackingEnabled && (
                <>
                  <span className="text-[var(--color-seen)]">
                    {seenCount} seen
                  </span>
                  <span className="text-[var(--color-owned)]">
                    {ownedCount} owned
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-muted)]">
              Sort
              <select
                aria-label="Pokédex order"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 font-bold text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                value={sort}
                onChange={(event) =>
                  onSortChange(event.target.value as PokedexSort)
                }
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-muted)]">
              Gen
              <select
                aria-label="Generation filter"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 font-bold text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                value={generation ?? "all"}
                onChange={(event) =>
                  onGenerationChange(
                    event.target.value === "all"
                      ? null
                      : Number(event.target.value),
                  )
                }
              >
                <option value="all">All</option>
                {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          {trackingEnabled && (
            <div
              className="flex gap-1 overflow-x-auto"
              aria-label="Pokédex status filter"
            >
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  className={`flex-shrink-0 rounded-xl px-3 py-2 text-xs font-black ${
                    filter === option.value
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-panel)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                  type="button"
                  onClick={() => onFilterChange(option.value)}
                  aria-pressed={filter === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <label className="relative min-w-0 flex-1 sm:ml-auto sm:max-w-xs">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.8-3.8" />
            </svg>
            <span className="sr-only">Search Pokédex</span>
            <input
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] py-2 pl-9 pr-3 text-xs font-bold text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Filter Pokédex…"
              autoComplete="off"
            />
          </label>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {state === "loading" && entries.length === 0 ? (
          <div
            className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8"
            aria-label="Loading Pokédex"
          >
            {Array.from({ length: 24 }, (_, key) => (
              <div
                key={key}
                className="aspect-[4/5] animate-pulse rounded-xl bg-[var(--color-panel)]"
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-panel)]/35 p-8 text-center">
            <div>
              <div
                className="mx-auto mb-3 h-12 w-12 rounded-full border-[7px] border-[var(--color-border)] border-t-[var(--color-accent)] -rotate-12"
                aria-hidden="true"
              />
              <h3 className="font-black text-[var(--color-text)]">
                {state === "error"
                  ? "Pokédex is unavailable"
                  : query
                    ? "No matching Pokémon"
                    : "No Pokédex entries"}
              </h3>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text-muted)]">
                {state === "error"
                  ? "Unable to load Pokédex data."
                  : "Try another order, generation, or name."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8">
            {entries.map((entry) => (
              <button
                key={entry.id}
                className={`group relative min-w-0 overflow-hidden rounded-xl border p-1.5 text-center transition-transform hover:-translate-y-0.5 ${
                  entry.status === "owned"
                    ? "border-[var(--color-owned)] bg-[var(--color-owned-soft)]"
                    : entry.status === "seen"
                      ? "border-[var(--color-seen)] bg-[var(--color-seen-soft)]"
                      : "border-[var(--color-border)] bg-[var(--color-panel)]"
                }`}
                type="button"
                onClick={() => onPokemonSelect?.(entry)}
                disabled={!onPokemonSelect}
              >
                <div className="text-[8px] font-bold text-[var(--color-text-muted)] [font-family:var(--font-mono)]">
                  {displayNumber(entry, sort)}
                </div>
                <PokemonArtwork
                  name={entry.name}
                  spritePath={entry.spritePath}
                  status={entry.status}
                  className="mx-auto aspect-square w-full max-w-16"
                />
                <div className="truncate text-[9px] font-black text-[var(--color-text)] sm:text-[10px]">
                  {entry.status === "unseen" ? "???" : entry.name}
                </div>
                {entry.status === "owned" && (
                  <PokeBallIcon className="absolute right-1 top-1 h-4 w-4" />
                )}
                {entry.status === "seen" && (
                  <SeenIcon className="absolute right-1 top-1 h-4 w-4 text-[var(--color-seen)]" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
