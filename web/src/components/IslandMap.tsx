import { useId } from "react"
import type { IslandMapModel, ResourceState } from "../types/presentation"

interface CompletionArcProps {
  cx: number
  cy: number
  radius: number
  owned: number
  total: number
  color: string
}
function CompletionArc({
  cx,
  cy,
  radius,
  owned,
  total,
  color,
}: CompletionArcProps) {
  if (total <= 0 || owned <= 0) return null

  const sweep = Math.min(owned / total, 1) * 2 * Math.PI
  const startAngle = -Math.PI / 2
  const endAngle = startAngle + sweep
  const x1 = cx + radius * Math.cos(startAngle)
  const y1 = cy + radius * Math.sin(startAngle)
  const x2 = cx + radius * Math.cos(endAngle)
  const y2 = cy + radius * Math.sin(endAngle)

  return (
    <path
      d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${
        sweep > Math.PI ? 1 : 0
      } 1 ${x2} ${y2}`}
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  )
}

interface IslandMapProps {
  map: IslandMapModel | null
  selectedLocationId: string | null
  accentColor: string
  state: ResourceState
  onSelectLocation: (locationId: string) => void
}

export default function IslandMap({
  map,
  selectedLocationId,
  accentColor,
  state,
  onSelectLocation,
}: IslandMapProps) {
  const patternId = `topo-${useId().replace(/:/g, "")}`
  const clipId = `island-${useId().replace(/:/g, "")}`

  if (!map) {
    return (
      <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-panel)]/45 px-4 text-center">
        <div className={state === "loading" ? "animate-pulse" : ""}>
          <svg
            className="mx-auto mb-2 h-7 w-7 text-[var(--color-text-muted)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="m9 18-6-3V5l6 3 6-3 6 3v10l-6-3-6 3Z" />
            <path d="M9 8v10m6-13v10" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            {state === "loading"
              ? "Loading island map"
              : "No island map loaded"}
          </span>
        </div>
      </div>
    )
  }

  const nodeById = new Map(map.nodes.map((node) => [node.id, node]))

  return (
    <div className="relative w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${map.width} ${map.height}`}
        className="h-auto w-full"
        style={{ maxHeight: "260px" }}
      >
        <polygon
          points={map.outline}
          fill="var(--color-panel)"
          stroke="var(--color-border)"
          strokeWidth="1.5"
        />
        <defs>
          <pattern
            id={patternId}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 10 Q5 8 10 10 Q15 12 20 10"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="0.4"
              opacity="0.5"
            />
          </pattern>
          <clipPath id={clipId}>
            <polygon points={map.outline} />
          </clipPath>
        </defs>
        <rect
          width={map.width}
          height={map.height}
          fill={`url(#${patternId})`}
          clipPath={`url(#${clipId})`}
          opacity="0.5"
        />

        {map.edges.map((edge) => {
          const from = nodeById.get(edge.fromNodeId)
          const to = nodeById.get(edge.toNodeId)
          if (!from || !to) return null
          return (
            <line
              key={`${edge.fromNodeId}-${edge.toNodeId}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--color-border)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          )
        })}

        {map.nodes.map((node) => {
          const isSelected = node.locationId === selectedLocationId
          const radius = isSelected ? 10 : 8
          return (
            <g
              key={node.id}
              className={node.locationId ? "cursor-pointer" : ""}
              onClick={() =>
                node.locationId && onSelectLocation(node.locationId)
              }
              style={{ opacity: node.locationId ? 1 : 0.35 }}
              role={node.locationId ? "button" : undefined}
              aria-label={node.locationId ? node.label : undefined}
              tabIndex={node.locationId ? 0 : undefined}
              onKeyDown={(event) => {
                if (
                  node.locationId &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault()
                  onSelectLocation(node.locationId)
                }
              }}
            >
              {isSelected && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius + 4}
                  fill={accentColor}
                  opacity="0.2"
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={
                  isSelected
                    ? accentColor
                    : node.hasEncounters
                      ? "var(--color-surface)"
                      : "var(--color-panel)"
                }
                stroke={isSelected ? accentColor : "var(--color-border)"}
                strokeWidth={isSelected ? 2 : 1.5}
              />
              <CompletionArc
                cx={node.x}
                cy={node.y}
                radius={radius + 3}
                owned={node.completion?.owned ?? 0}
                total={node.completion?.total ?? 0}
                color={accentColor}
              />
              {node.hasEncounters && !isSelected && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="2.5"
                  fill={accentColor}
                  opacity="0.8"
                />
              )}
              <text
                x={node.x}
                y={node.y + radius + 12}
                textAnchor="middle"
                fontSize="8"
                fontFamily="var(--font-game)"
                fontWeight={isSelected ? "800" : "600"}
                fill={isSelected ? accentColor : "var(--color-text-muted)"}
              >
                {node.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
