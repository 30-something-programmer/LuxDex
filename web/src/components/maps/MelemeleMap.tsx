import { useEffect, useId, useState } from "react"
import type { LocationOption } from "../../types/presentation"

export interface MapRegion {
  locationKey: string
  points: number[][]
}
interface Props {
  locations: LocationOption[]
  regions: MapRegion[]
  selectedLocationId: string | null
  onSelectLocation: (id: string) => void
}

export default function MelemeleMap(props: Props) {
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    if (!expanded) return
    const close = (event: KeyboardEvent) =>
      event.key === "Escape" && setExpanded(false)
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [expanded])
  return (
    <>
      <MapSurface
        {...props}
        expanded={false}
        onExpand={() => setExpanded(true)}
      />
      {expanded && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded Melemele map"
          onClick={() => setExpanded(false)}
        >
          <div
            className="max-h-[94vh] w-full max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <MapSurface
              {...props}
              expanded
              onExpand={() => setExpanded(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}

function MapSurface({
  locations,
  regions,
  selectedLocationId,
  onSelectLocation,
  expanded,
  onExpand,
}: Props & { expanded: boolean; onExpand: () => void }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const clipId = `selected-${useId().replace(/:/g, "")}`
  const byKey = new Map(locations.map((location) => [location.id, location]))
  const visible = regions.filter((region) => byKey.has(region.locationKey))
  const selected = visible.find(
    (region) => region.locationKey === selectedLocationId,
  )
  const active = byKey.get(hovered ?? "") ?? byKey.get(selectedLocationId ?? "")
  const points = (region: MapRegion) =>
    region.points.map(([x, y]) => `${x},${y}`).join(" ")
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-black shadow-xl">
      <div className="relative aspect-[1240/1090] w-full">
        <img
          src="/assets/maps/melemele.png"
          alt="Melemele Island"
          draggable={false}
          className="h-full w-full select-none object-cover opacity-25 saturate-[.2] brightness-[.45]"
        />
        {selected && (
          <svg
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <defs>
              <clipPath id={clipId}>
                <polygon points={points(selected)} />
              </clipPath>
            </defs>
            <image
              href="/assets/maps/melemele.png"
              width="1"
              height="1"
              preserveAspectRatio="none"
              clipPath={`url(#${clipId})`}
              opacity=".82"
            />
          </svg>
        )}
        <svg
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Melemele Island interactive map"
        >
          {visible.map((region) => {
            const location = byKey.get(region.locationKey)!
            const isSelected = region.locationKey === selectedLocationId
            const isHovered = region.locationKey === hovered
            return (
              <polygon
                key={region.locationKey}
                points={points(region)}
                vectorEffect="non-scaling-stroke"
                role="button"
                tabIndex={0}
                aria-label={`Open ${location.name}`}
                className="cursor-pointer outline-none"
                fill="var(--color-melemele)"
                fillOpacity={isSelected ? 0.13 : isHovered ? 0.22 : 0.02}
                stroke="var(--color-melemele)"
                strokeWidth={isSelected ? 7 : isHovered ? 3 : 1}
                onMouseEnter={() => setHovered(region.locationKey)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(region.locationKey)}
                onBlur={() => setHovered(null)}
                onClick={() => onSelectLocation(region.locationKey)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onSelectLocation(region.locationKey)
                  }
                }}
              />
            )
          })}
        </svg>
      </div>
      <button
        type="button"
        className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-lg bg-black/75 text-white"
        onClick={onExpand}
        aria-label={expanded ? "Close expanded map" : "Expand map"}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M8 3H3v5M16 3h5v5M8 21H3v-5m13 5h5v-5" />
        </svg>
      </button>
      {active && (
        <span className="pointer-events-none absolute left-2 top-2 max-w-[70%] rounded-md bg-black/80 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[var(--color-melemele)]">
          {active.name}
        </span>
      )}
    </div>
  )
}
