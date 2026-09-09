import type {
  IslandMapModel,
  LocationOption,
  ResourceState,
} from "../types/presentation"
import AreaNav from "./AreaNav"
import IslandMap from "./IslandMap"

interface SidebarProps {
  title: string
  accentColor: string
  map: IslandMapModel | null
  locations: LocationOption[]
  selectedLocationId: string | null
  state: ResourceState
  onSelectLocation: (locationId: string) => void
  onClose?: () => void
}

export default function Sidebar({
  title,
  accentColor,
  map,
  locations,
  selectedLocationId,
  state,
  onSelectLocation,
  onClose,
}: SidebarProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--color-surface)]">
      <div className="flex-shrink-0 border-b border-[var(--color-border)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div
            className="text-xs font-black uppercase tracking-widest"
            style={{ color: accentColor }}
          >
            {title}
          </div>
          {onClose && (
            <button
              className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-panel)] lg:hidden"
              type="button"
              onClick={onClose}
              aria-label="Close location navigation"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <IslandMap
          map={map}
          selectedLocationId={selectedLocationId}
          accentColor={accentColor}
          state={state}
          onSelectLocation={onSelectLocation}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <AreaNav
          locations={locations}
          selectedLocationId={selectedLocationId}
          state={state}
          onSelect={onSelectLocation}
          onClose={onClose}
        />
      </div>
    </div>
  )
}
