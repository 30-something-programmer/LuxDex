import type { IslandOption, ResourceState } from "../types/presentation"

interface IslandTabsProps {
  islands: IslandOption[]
  activeIslandId: string | null
  state: ResourceState
  onSelect: (islandId: string) => void
}

export default function IslandTabs({
  islands,
  activeIslandId,
  state,
  onSelect,
}: IslandTabsProps) {
  return (
    <div
      className="flex min-h-12 flex-shrink-0 gap-1 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 pt-3"
      style={{ scrollbarWidth: "none" }}
      aria-label="Island quick navigation"
    >
      {state === "loading" && islands.length === 0 && (
        <>
          {[0, 1, 2, 3].map((key) => (
            <div
              key={key}
              className="mb-2 h-7 w-20 flex-shrink-0 animate-pulse rounded-lg bg-[var(--color-panel)]"
            />
          ))}
        </>
      )}

      {state !== "loading" && islands.length === 0 && (
        <div className="px-1 pb-3 text-xs font-semibold text-[var(--color-text-muted)]">
          Island navigation will appear when the API provides it.
        </div>
      )}

      {islands.map((island) => {
        const isActive = island.id === activeIslandId
        return (
          <button
            key={island.id}
            className={`flex-shrink-0 rounded-t-xl border-b-2 px-4 py-2 text-sm font-black transition-all ${
              isActive
                ? "bg-[var(--color-panel)]"
                : "border-transparent bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            style={
              isActive
                ? { color: island.color, borderColor: island.color }
                : undefined
            }
            type="button"
            onClick={() => onSelect(island.id)}
            aria-current={isActive ? "page" : undefined}
          >
            {island.name}
          </button>
        )
      })}
    </div>
  )
}
