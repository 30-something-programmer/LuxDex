import type {
  IslandMapModel,
  LocationOption,
  ResourceState,
} from "../types/presentation"
import AreaNav from "./AreaNav"
import IslandMap from "./IslandMap"
import MelemeleMap from "./maps/MelemeleMap"

interface SidebarProps {
  title: string
  accentColor: string
  groupKey: string | null
  map: IslandMapModel | null
  locations: LocationOption[]
  selectedLocationId: string | null
  state: ResourceState
  onSelectLocation: (locationId: string) => void
  onClose?: () => void
  emptyMessage?: string
}

// A real image + SVG overlay map only exists for Melemele so far (see
// web/src/components/maps/). Every other island falls back to the generic
// abstract IslandMap until its own backdrop is supplied — adding e.g.
// AkalaMap later is just another branch here, not a rewrite of AreasView.
function IslandMapForGroup({
  groupKey,
  map,
  accentColor,
  locations,
  selectedLocationId,
  state,
  onSelectLocation,
}: {
  groupKey: string | null
  map: IslandMapModel | null
  accentColor: string
  locations: LocationOption[]
  selectedLocationId: string | null
  state: ResourceState
  onSelectLocation: (locationId: string) => void
}) {
  if (groupKey === "melemele") {
    return (
      <MelemeleMap
        locations={locations}
        selectedLocationId={selectedLocationId}
        onSelectLocation={onSelectLocation}
      />
    )
  }

  return (
    <IslandMap
      map={map}
      selectedLocationId={selectedLocationId}
      accentColor={accentColor}
      state={state}
      onSelectLocation={onSelectLocation}
    />
  )
}

export default function Sidebar({
  title,
  accentColor,
  groupKey,
  map,
  locations,
  selectedLocationId,
  state,
  onSelectLocation,
  onClose,
  emptyMessage,
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
        <IslandMapForGroup
          groupKey={groupKey}
          map={map}
          accentColor={accentColor}
          locations={locations}
          selectedLocationId={selectedLocationId}
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
          emptyMessage={emptyMessage}
        />
      </div>
    </div>
  )
}
