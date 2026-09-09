import { useState } from "react"
import type { LocationOption } from "../../types/presentation"

// The supplied backdrop's native pixel size. The SVG overlay shares this
// exact viewBox so image and hit areas scale together with no separate
// positioning math to drift out of sync.
const IMAGE_WIDTH = 1240
const IMAGE_HEIGHT = 1090

interface MelemeleRegion {
  locationKey: string
  points: string
}

// Presentational hit-area geometry only: a canonical location key plus an
// SVG polygon. These are approximate interaction regions hand-placed over
// the backdrop image, not surveyed geography — see MelemeleMap's usage
// notes in the LuxDex handoff for which regions are confident vs. best
// effort. No encounter, Pokémon, or location data lives here; that stays
// backend-owned and is only ever looked up by locationKey below.
const REGIONS: MelemeleRegion[] = [
  {
    locationKey: "hauoli-outskirts",
    points: "10,255 145,255 145,420 110,480 55,520 10,470",
  },
  {
    locationKey: "trainers-school",
    points: "145,270 255,270 255,345 145,345",
  },
  {
    locationKey: "route-1",
    points:
      "145,100 330,90 430,190 400,300 330,340 255,345 255,270 300,220 270,170 200,140 145,180",
  },
  {
    locationKey: "route-3",
    points:
      "480,300 600,260 680,300 720,380 800,420 900,460 950,520 900,580 800,560 700,520 620,480 550,440 480,380",
  },
  {
    locationKey: "kalae-bay",
    points: "650,180 760,170 820,230 830,300 780,340 700,320 650,270 630,220",
  },
  {
    locationKey: "melemele-sea",
    points:
      "900,560 1050,560 1180,680 1220,880 1120,1020 900,1060 700,1010 600,900 580,750 620,650 750,590",
  },
]

interface MelemeleMapProps {
  locations: LocationOption[]
  selectedLocationId: string | null
  onSelectLocation: (locationId: string) => void
}

export default function MelemeleMap({
  locations,
  selectedLocationId,
  onSelectLocation,
}: MelemeleMapProps) {
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(
    null,
  )

  const locationsByKey = new Map(
    locations.map((location) => [location.id, location]),
  )
  // A region only renders when its canonical key is actually present in the
  // backend-provided location list — geography that isn't verified/mapped
  // yet stays absent rather than inventing a clickable area for it.
  const visibleRegions = REGIONS.filter((region) =>
    locationsByKey.has(region.locationKey),
  )

  const activeLocation =
    locationsByKey.get(hoveredLocationId ?? "") ??
    locationsByKey.get(selectedLocationId ?? "") ??
    null

  const clearHover = (locationKey: string) =>
    setHoveredLocationId((current) =>
      current === locationKey ? null : current,
    )

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]">
      <div className="relative w-full">
        <img
          src="/assets/maps/melemele.png"
          alt="Melemele Island"
          className="block h-auto w-full select-none"
          draggable={false}
        />
        <svg
          viewBox={`0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}`}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Melemele Island interactive map"
        >
          {visibleRegions.map((region) => {
            const location = locationsByKey.get(region.locationKey)
            if (!location) return null
            const isSelected = region.locationKey === selectedLocationId
            const isHovered = region.locationKey === hoveredLocationId
            const fillOpacity = isHovered ? 0.38 : isSelected ? 0.2 : 0
            const strokeWidth = isHovered ? 3 : isSelected ? 2 : 0

            return (
              <polygon
                key={region.locationKey}
                points={region.points}
                tabIndex={0}
                role="button"
                aria-label={`Open ${location.name}`}
                className="cursor-pointer outline-none"
                fill="var(--color-melemele)"
                fillOpacity={fillOpacity}
                stroke="var(--color-melemele)"
                strokeWidth={strokeWidth}
                style={{
                  transition: "fill-opacity 120ms ease, stroke-width 120ms ease",
                  filter: isHovered
                    ? "drop-shadow(0 0 6px var(--color-melemele))"
                    : undefined,
                }}
                onMouseEnter={() => setHoveredLocationId(region.locationKey)}
                onMouseLeave={() => clearHover(region.locationKey)}
                onFocus={() => setHoveredLocationId(region.locationKey)}
                onBlur={() => clearHover(region.locationKey)}
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

      <div className="pointer-events-none absolute left-2 top-2 max-w-[75%]">
        {activeLocation && (
          <span className="inline-block rounded-md bg-[var(--color-surface)]/90 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[var(--color-melemele)] shadow">
            {activeLocation.name}
          </span>
        )}
      </div>
    </div>
  )
}
