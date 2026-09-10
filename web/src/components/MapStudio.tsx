import { useEffect, useId, useMemo, useRef, useState } from "react"
import {
  deleteStudioGeometry,
  getMapStudio,
  saveStudioGeometry,
  saveStudioPlacement,
} from "../api/mapStudio"
import type { StudioDocumentResponse, StudioNodeResponse } from "../api/types"
import PokemonArtwork, { PokeBallIcon, SeenIcon } from "./PokemonArtwork"

interface MapStudioProps {
  onCollectionChange: (canonicalKey: string, state: "seen" | "owned") => void
  onDocumentChange?: (document: StudioDocumentResponse) => void
}

const emptyDocument: StudioDocumentResponse = {
  nodes: [],
  pokemon: [],
  placements: [],
}

interface GeometryBounds {
  x: number
  y: number
  width: number
  height: number
}

const geometryBounds = (
  geometry: number[][] | null | undefined,
): GeometryBounds => {
  if (!geometry?.length) return { x: 0, y: 0, width: 1, height: 1 }
  const xs = geometry.map(([x]) => x)
  const ys = geometry.map(([, y]) => y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    x,
    y,
    width: Math.max(Math.max(...xs) - x, Number.EPSILON),
    height: Math.max(Math.max(...ys) - y, Number.EPSILON),
  }
}

const pointsInBounds = (geometry: number[][], bounds: GeometryBounds) =>
  geometry.map(([x, y]) => [
    (x - bounds.x) / bounds.width,
    (y - bounds.y) / bounds.height,
  ])

const svgPoints = (geometry: number[][], width = 1000, height = 700) =>
  geometry.map(([x, y]) => `${x * width},${y * height}`).join(" ")

export default function MapStudio({
  onCollectionChange,
  onDocumentChange,
}: MapStudioProps) {
  const [document, setDocument] = useState(emptyDocument)
  const [selectedKey, setSelectedKey] = useState("island:melemele")
  const [points, setPoints] = useState<number[][]>([])
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [trial, setTrial] = useState(false)
  const [hoveredOverviewKey, setHoveredOverviewKey] = useState<string | null>(
    null,
  )
  const [message, setMessage] = useState("Loading presentation data…")
  const canvasRef = useRef<SVGSVGElement>(null)
  const clipId = `studio-${useId().replace(/:/g, "")}`

  const reload = () =>
    getMapStudio()
      .then((result) => {
        setDocument(result)
        onDocumentChange?.(result)
        setMessage("")
      })
      .catch(() => setMessage("Map Studio data is unavailable."))

  useEffect(() => {
    void reload()
  }, [])
  const selected =
    document.nodes.find((node) => node.node_key === selectedKey) ?? null
  const parent =
    document.nodes.find((node) => node.node_key === selected?.parent_key) ??
    null
  const island =
    selected?.node_type === "island"
      ? selected
      : selected?.node_type === "location"
        ? parent
        : selected?.node_type === "zone"
          ? (document.nodes.find(
              (node) => node.node_key === parent?.parent_key,
            ) ?? null)
          : null
  const mapAsset = island?.asset_path ?? null
  const isIslandOverview = selected?.node_type === "island"
  const canEditPolygon = (selected?.layer ?? 0) >= 3
  const overviewRegions = isIslandOverview
    ? document.nodes.filter(
        (node) =>
          node.parent_key === selected.node_key &&
          node.node_type === "location" &&
          node.geometry,
      )
    : []
  const hoveredOverview = overviewRegions.find(
    (node) => node.node_key === hoveredOverviewKey,
  )
  const cropBounds =
    selected?.node_type === "zone" && parent?.geometry
      ? geometryBounds(parent.geometry)
      : null
  const parentBoundary =
    cropBounds && parent?.geometry
      ? pointsInBounds(parent.geometry, cropBounds)
      : null
  useEffect(() => {
    setPoints(selected?.geometry?.map((point) => [...point]) ?? [])
    setSelectedPoint(null)
    setDrawing(false)
    setHoveredOverviewKey(null)
  }, [selectedKey, selected?.geometry])

  const children = (parentKey: string | null) =>
    document.nodes.filter((node) => node.parent_key === parentKey)
  const zonePokemon = document.pokemon.filter(
    (item) => item.zone_node_key === selectedKey,
  )
  const contextHelp = isIslandOverview
    ? "Island overview · move over a mapped location to highlight its complete boundary."
    : selected?.node_type === "zone"
      ? `Zoomed crop of ${parent?.display_name ?? "the parent location"} · zone coordinates remain relative to this boundary.`
      : selected?.node_type === "location"
        ? `Editing ${selected.display_name} within the full ${parent?.display_name ?? "island"} boundary.`
        : "No authored world-map asset is configured."
  const canvasPoint = (clientX: number, clientY: number) => {
    const bounds = canvasRef.current!.getBoundingClientRect()
    return [
      Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)),
      Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height)),
    ]
  }
  const pointString = svgPoints(points)

  const tree = useMemo(() => {
    const render = (node: StudioNodeResponse): React.ReactNode => (
      <li key={node.node_key}>
        <button
          className={`w-full rounded-lg px-2 py-1.5 text-left text-xs font-bold ${
            selectedKey === node.node_key
              ? "bg-[var(--color-melemele)] text-[#07150d]"
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-panel)]"
          }`}
          type="button"
          onClick={() => setSelectedKey(node.node_key)}
        >
          <span className="mr-1 opacity-60">L{node.layer}</span>{" "}
          {node.display_name}
          <span className="float-right text-[9px] opacity-60">
            {node.geometry ? "Mapped" : "Draft"}
          </span>
        </button>
        {children(node.node_key).length > 0 && (
          <ul className="ml-3 border-l border-[var(--color-border)] pl-1">
            {children(node.node_key).map(render)}
          </ul>
        )}
      </li>
    )
    return children(null).map(render)
  }, [document.nodes, selectedKey])

  if (trial) {
    const trialZone = document.nodes.find(
      (node) => node.node_type === "zone" && node.geometry,
    )
    const pokemon = document.pokemon.filter(
      (item) => item.zone_node_key === trialZone?.node_key,
    )
    const trialPlacements = document.placements.filter(
      (item) => item.zone_node_key === trialZone?.node_key,
    )
    const trialParent = document.nodes.find(
      (node) => node.node_key === trialZone?.parent_key,
    )
    const parentBounds = geometryBounds(trialParent?.geometry)
    const zoneInIsland =
      trialZone?.geometry?.map(([x, y]) => [
        parentBounds.x + x * parentBounds.width,
        parentBounds.y + y * parentBounds.height,
      ]) ?? []
    const zoneBounds = geometryBounds(zoneInIsland)
    return (
      <div className="flex h-full flex-col bg-[var(--color-bg)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-melemele)]">
              Map Studio · Trial
            </p>
            <h2 className="text-xl font-black">Melemele</h2>
          </div>
          <button
            className="rounded-xl bg-[var(--color-panel)] px-4 py-2 text-xs font-black"
            onClick={() => setTrial(false)}
          >
            Back to editor
          </button>
        </div>
        <div className="relative mx-auto aspect-[1240/1090] max-h-full w-full max-w-4xl overflow-hidden rounded-2xl border-2 border-[var(--color-melemele)] bg-black">
          <img
            className="h-full w-full object-cover opacity-35 saturate-[.35]"
            src="/assets/maps/melemele.png"
            alt="Melemele Trial"
          />
          <div className="absolute inset-0">
            {zoneInIsland.length > 2 && (
              <svg
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 h-full w-full"
              >
                <polygon
                  points={zoneInIsland
                    .map(([x, y]) => `${x},${y}`)
                    .join(" ")}
                  fill="var(--color-melemele)"
                  fillOpacity=".16"
                  stroke="var(--color-melemele)"
                  strokeWidth="4"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
            {pokemon.map((item, index) => {
              const placement = trialPlacements.find(
                (entry) => entry.canonical_key === item.canonical_key,
              )
              const relativeX = placement?.x ?? 0.2 + (index % 4) * 0.2
              const relativeY =
                placement?.y ?? 0.3 + Math.floor(index / 4) * 0.22
              const x = zoneBounds.x + relativeX * zoneBounds.width
              const y = zoneBounds.y + relativeY * zoneBounds.height
              return (
                <button
                  key={item.canonical_key}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                  onClick={() => {
                    const state =
                      item.collection_state === "unseen" ? "seen" : "owned"
                    onCollectionChange(item.canonical_key, state)
                    setDocument((current) => ({
                      ...current,
                      pokemon: current.pokemon.map((entry) =>
                        entry.canonical_key === item.canonical_key
                          ? { ...entry, collection_state: state }
                          : entry,
                      ),
                    }))
                  }}
                >
                  <PokemonArtwork
                    name={item.display_name}
                    spritePath={item.sprite_path}
                    status={
                      item.collection_state === "unseen" ? "unseen" : "owned"
                    }
                    className="h-20 w-20"
                  />
                  <span className="block rounded bg-black/70 px-1 text-[11px] font-black">
                    {item.display_name}
                  </span>
                  {item.collection_state === "seen" && (
                    <SeenIcon className="absolute right-0 top-0 h-5 w-5 text-white" />
                  )}
                  {item.collection_state === "owned" && (
                    <PokeBallIcon className="absolute right-0 top-0 h-5 w-5" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[15rem_1fr_15rem] bg-[var(--color-bg)]">
      <aside className="overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-[var(--color-sos)]">
          Internal authoring tool
        </p>
        <h2 className="mb-3 text-lg font-black">MAP STUDIO</h2>
        <ul className="space-y-1">{tree}</ul>
      </aside>
      <main className="flex min-w-0 flex-col p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h3 className="font-black">
              {selected?.display_name ?? "Select a layer"}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Parent boundary: {parent?.display_name ?? "none"} · normalised 0–1
              coordinates
            </p>
            <p
              data-testid="studio-context-help"
              className="text-[10px] font-bold text-[var(--color-melemele)]"
            >
              {contextHelp}
              {hoveredOverview && ` Hovering: ${hoveredOverview.display_name}`}
            </p>
          </div>
          <button
            className="rounded-lg bg-[var(--color-panel)] px-3 py-2 text-xs font-bold disabled:opacity-35"
            disabled={!canEditPolygon}
            onClick={() => {
              setPoints([])
              setDrawing(true)
            }}
          >
            Create polygon
          </button>
          <button
            className="rounded-lg bg-[var(--color-panel)] px-3 py-2 text-xs font-bold disabled:opacity-35"
            disabled={!canEditPolygon}
            onClick={() => setDrawing((value) => !value)}
          >
            {drawing ? "Finish adding" : "Add point"}
          </button>
          <button
            className="rounded-lg bg-[var(--color-panel)] px-3 py-2 text-xs font-bold"
            disabled={
              !canEditPolygon || selectedPoint == null || points.length <= 3
            }
            onClick={() =>
              setPoints((current) =>
                current.filter((_, index) => index !== selectedPoint),
              )
            }
          >
            Remove point
          </button>
          <button
            className="rounded-lg border border-[var(--color-danger)] px-3 py-2 text-xs font-bold text-[var(--color-danger)]"
            disabled={!canEditPolygon}
            onClick={() =>
              selected &&
              window.confirm(
                `Delete the presentation polygon for ${selected.display_name}?`,
              ) &&
              deleteStudioGeometry(selected.node_key).then(reload)
            }
          >
            Delete polygon
          </button>
          <button
            className="rounded-lg bg-[var(--color-melemele)] px-4 py-2 text-xs font-black text-[#07150d]"
            disabled={!canEditPolygon || points.length < 3}
            onClick={() =>
              selected &&
              saveStudioGeometry(selected.node_key, points).then(() => {
                setMessage("Saved")
                reload()
              })
            }
          >
            Save
          </button>
          <button
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-black text-white"
            onClick={() => setTrial(true)}
          >
            TRIAL
          </button>
        </div>
        {message && (
          <p
            role="status"
            className="mb-2 text-xs text-[var(--color-text-muted)]"
          >
            {message}
          </p>
        )}
        <svg
          ref={canvasRef}
          viewBox="0 0 1000 700"
          data-testid="studio-canvas"
          data-context={
            isIslandOverview
              ? "island-overview"
              : selected?.node_type === "zone"
                ? "location-crop"
                : selected?.node_type ?? "none"
          }
          aria-label={`${selected?.display_name ?? "Map Studio"} authoring canvas`}
          className="min-h-0 flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]"
          onClick={(event) => {
            if (drawing && canEditPolygon)
              setPoints((current) => [
                ...current,
                canvasPoint(event.clientX, event.clientY),
              ])
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const key = event.dataTransfer.getData("text/canonical-key")
            if (selected?.node_type === "zone" && key) {
              const [x, y] = canvasPoint(event.clientX, event.clientY)
              saveStudioPlacement(selected.node_key, key, x, y).then(reload)
            }
          }}
        >
          <defs>
            {hoveredOverview?.geometry && (
              <clipPath id={`${clipId}-overview`}>
                <polygon points={svgPoints(hoveredOverview.geometry)} />
              </clipPath>
            )}
            {parentBoundary && (
              <clipPath id={`${clipId}-parent`}>
                <polygon points={svgPoints(parentBoundary)} />
              </clipPath>
            )}
          </defs>
          {isIslandOverview && mapAsset && (
            <image
              href={mapAsset}
              width="1000"
              height="700"
              preserveAspectRatio="none"
              opacity=".58"
              style={{ filter: "saturate(.7) brightness(.72)" }}
            />
          )}
          {isIslandOverview && mapAsset && hoveredOverview?.geometry && (
            <image
              href={mapAsset}
              width="1000"
              height="700"
              preserveAspectRatio="none"
              clipPath={`url(#${clipId}-overview)`}
              opacity="1"
              style={{ filter: "saturate(1.1) brightness(1.08)" }}
            />
          )}
          {selected?.node_type === "location" && (
            <image
              href={mapAsset ?? "/assets/maps/melemele.png"}
              width="1000"
              height="700"
              preserveAspectRatio="xMidYMid slice"
              opacity=".22"
              style={{ filter: "saturate(.25) brightness(.55)" }}
            />
          )}
          {selected?.node_type === "zone" && mapAsset && cropBounds && (
            <>
              <image
                data-testid="studio-cropped-map"
                data-crop={`${cropBounds.x},${cropBounds.y},${cropBounds.width},${cropBounds.height}`}
                href={mapAsset}
                x={(-cropBounds.x / cropBounds.width) * 1000}
                y={(-cropBounds.y / cropBounds.height) * 700}
                width={1000 / cropBounds.width}
                height={700 / cropBounds.height}
                preserveAspectRatio="none"
                opacity=".13"
                style={{ filter: "saturate(.3) brightness(.45)" }}
              />
              <image
                href={mapAsset}
                x={(-cropBounds.x / cropBounds.width) * 1000}
                y={(-cropBounds.y / cropBounds.height) * 700}
                width={1000 / cropBounds.width}
                height={700 / cropBounds.height}
                preserveAspectRatio="none"
                clipPath={`url(#${clipId}-parent)`}
                opacity=".68"
                style={{ filter: "saturate(.72) brightness(.72)" }}
              />
            </>
          )}
          {!isIslandOverview && (
            <rect
              x="5"
              y="5"
              width="990"
              height="690"
              fill="none"
              stroke="var(--color-text-muted)"
              strokeDasharray="10 8"
              opacity=".45"
            />
          )}
          {parentBoundary && (
            <polygon
              points={svgPoints(parentBoundary)}
              fill="none"
              stroke="var(--color-text-muted)"
              strokeWidth="3"
              strokeDasharray="9 7"
              vectorEffect="non-scaling-stroke"
              opacity=".8"
            />
          )}
          {isIslandOverview &&
            overviewRegions.map((node) => {
              const isHovered = node.node_key === hoveredOverviewKey
              return (
                <polygon
                  key={node.node_key}
                  points={svgPoints(node.geometry!)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${node.display_name}`}
                  className="cursor-pointer outline-none"
                  fill="var(--color-melemele)"
                  fillOpacity={isHovered ? ".24" : ".035"}
                  stroke="var(--color-melemele)"
                  strokeWidth={isHovered ? "5" : "1.5"}
                  vectorEffect="non-scaling-stroke"
                  onMouseEnter={() => setHoveredOverviewKey(node.node_key)}
                  onMouseLeave={() => setHoveredOverviewKey(null)}
                  onFocus={() => setHoveredOverviewKey(node.node_key)}
                  onBlur={() => setHoveredOverviewKey(null)}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedKey(node.node_key)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      setSelectedKey(node.node_key)
                    }
                  }}
                />
              )
            })}
          {canEditPolygon && points.length >= 2 && (
            <polygon
              points={pointString}
              fill="var(--color-melemele)"
              fillOpacity=".22"
              stroke="var(--color-melemele)"
              strokeWidth="4"
            />
          )}
          {canEditPolygon &&
            points.map(([x, y], index) => (
              <circle
              key={index}
              cx={x * 1000}
              cy={y * 700}
              r="9"
              fill={selectedPoint === index ? "white" : "var(--color-melemele)"}
              stroke="#07150d"
              strokeWidth="3"
              onPointerDown={(event) => {
                event.stopPropagation()
                setSelectedPoint(index)
                const move = (moveEvent: PointerEvent) => {
                  const [nx, ny] = canvasPoint(
                    moveEvent.clientX,
                    moveEvent.clientY,
                  )
                  setPoints((current) =>
                    current.map((point, i) => (i === index ? [nx, ny] : point)),
                  )
                }
                const up = () => {
                  window.removeEventListener("pointermove", move)
                  window.removeEventListener("pointerup", up)
                }
                window.addEventListener("pointermove", move)
                window.addEventListener("pointerup", up)
              }}
              />
            ))}
        </svg>
      </main>
      <aside className="overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <h3 className="text-xs font-black uppercase tracking-widest">
          Zone palette
        </h3>
        <p className="mb-3 text-[10px] text-[var(--color-text-muted)]">
          Drag canonical encounters onto the zone. This changes presentation
          only.
        </p>
        {selected?.node_type !== "zone" ? (
          <p className="text-xs text-[var(--color-text-muted)]">
            Select a Layer 4 zone.
          </p>
        ) : zonePokemon.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">
            No canonical encounters.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {zonePokemon.map((item) => (
              <div
                key={item.canonical_key}
                draggable
                onDragStart={(event) =>
                  event.dataTransfer.setData(
                    "text/canonical-key",
                    item.canonical_key,
                  )
                }
                className="rounded-xl bg-[var(--color-panel)] p-2 text-center"
              >
                <PokemonArtwork
                  name={item.display_name}
                  spritePath={item.sprite_path}
                  status="owned"
                  className="mx-auto h-14 w-14"
                />
                <span className="text-[10px] font-bold">
                  {item.display_name}
                </span>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}
