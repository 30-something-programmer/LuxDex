import { useMemo, useState } from "react"
import type { LocationOption, ResourceState } from "../types/presentation"

interface AreaNavProps {
  locations: LocationOption[]
  selectedLocationId: string | null
  state: ResourceState
  onSelect: (locationId: string) => void
  onClose?: () => void
}
export default function AreaNav({
  locations,
  selectedLocationId,
  state,
  onSelect,
  onClose,
}: AreaNavProps) {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredLocations = useMemo(
    () =>
      normalizedQuery
        ? locations.filter((location) =>
            [location.name, ...(location.aliases ?? [])].some((name) =>
              name.toLocaleLowerCase().includes(normalizedQuery),
            ),
          )
        : locations,
    [locations, normalizedQuery],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[var(--color-border)] p-2">
        <label className="relative block">
          <span className="sr-only">Search locations</span>
          <svg
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] py-1.5 pl-8 pr-2 text-xs font-semibold text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:ring-1 focus:ring-[var(--color-accent)]/40"
            type="search"
            placeholder="Search…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={state === "loading"}
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
        {state === "loading" &&
          locations.length === 0 &&
          [0, 1, 2, 3, 4].map((key) => (
            <div
              key={key}
              className="h-7 animate-pulse rounded-lg bg-[var(--color-panel)]"
            />
          ))}

        {state !== "loading" && filteredLocations.length === 0 && (
          <div className="px-2.5 py-5 text-center text-xs font-semibold text-[var(--color-text-muted)]">
            {query ? "No matching locations" : "No locations loaded"}
          </div>
        )}

        {filteredLocations.map((location) => {
          const isSelected = location.id === selectedLocationId
          return (
            <button
              key={location.id}
              className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-[var(--color-accent)] text-white"
                  : location.hasEncounters
                    ? "text-[var(--color-text)] hover:bg-[var(--color-panel)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-panel)]/50"
              }`}
              type="button"
              onClick={() => {
                onSelect(location.id)
                onClose?.()
              }}
            >
              <span className="block truncate">{location.name}</span>
              {location.secondaryLabel && (
                <span className="mt-0.5 block truncate text-[9px] opacity-65">
                  {location.secondaryLabel}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
