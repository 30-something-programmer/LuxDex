import type { Area } from '../data/types';
import type { IslandId, IslandMapData, MapNode } from '../data/islands';
import { ISLAND_MAPS } from '../data/islands';

interface Props {
  island: IslandId;
  areas: Area[];
  selectedAreaId: string;
  onSelectArea: (id: string) => void;
  getAreaCompletion: (areaId: string) => { caught: number; total: number };
}

// Find which area matches a node pattern
function matchArea(areas: Area[], pattern: RegExp): Area | undefined {
  return areas.find(a =>
    pattern.test(a.primaryName) || a.allNames.some(n => pattern.test(n))
  );
}

// Completion arc: draws a small arc around the node circle
function CompletionArc({ cx, cy, r, caught, total, color }: {
  cx: number; cy: number; r: number; caught: number; total: number; color: string;
}) {
  if (total === 0) return null;
  const pct = caught / total;
  if (pct <= 0) return null;

  const sweep = pct * 2 * Math.PI;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + sweep;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = sweep > Math.PI ? 1 : 0;

  return (
    <path
      d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  );
}

export default function IslandMap({ island, areas, selectedAreaId, onSelectArea, getAreaCompletion }: Props) {
  const mapData: IslandMapData | undefined = ISLAND_MAPS.find(m => m.island === island);

  // For "other" or no map data — show a simple list
  if (!mapData) {
    const islandAreas = areas.filter(a => a.tables.length > 0);
    return (
      <div className="p-4">
        <div className="text-xs font-bold text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">Locations</div>
        <div className="grid grid-cols-2 gap-1.5">
          {islandAreas.map(a => (
            <button
              key={a.id}
              className={`text-left px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                a.id === selectedAreaId
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-panel)] text-[var(--color-text)] hover:bg-[var(--color-panel-hover)]'
              }`}
              onClick={() => onSelectArea(a.id)}
            >
              {a.primaryName}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const { width, height, outline, nodes, edges } = mapData;

  // Resolve each node to its area
  const resolvedNodes = nodes.map(node => ({
    ...node,
    area: matchArea(areas, node.areaNamePattern),
  }));

  // Build edge paths
  const edgePaths = edges.map(({ from, to }, i) => {
    const fromNode = nodes.find(n => from.test(n.label) || areas.some(a => from.test(a.primaryName) && n.areaNamePattern.test(a.primaryName)));
    const toNode = nodes.find(n => to.test(n.label) || areas.some(a => to.test(a.primaryName) && n.areaNamePattern.test(a.primaryName)));
    if (!fromNode || !toNode) return null;
    return (
      <line
        key={i}
        x1={fromNode.x} y1={fromNode.y}
        x2={toNode.x}   y2={toNode.y}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
    );
  }).filter(Boolean);

  // Island accent color
  const islandColor = island === 'melemele' ? 'var(--color-melemele)'
    : island === 'akala'   ? 'var(--color-akala)'
    : island === 'ulaula'  ? 'var(--color-ulaula)'
    : 'var(--color-poni)';

  return (
    <div className="relative w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        style={{ maxHeight: '260px' }}
      >
        {/* Island fill */}
        <polygon
          points={outline}
          fill="var(--color-panel)"
          stroke="var(--color-border)"
          strokeWidth="1.5"
        />

        {/* Subtle topographic grid lines */}
        <defs>
          <pattern id="topo" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M0 10 Q5 8 10 10 Q15 12 20 10" fill="none" stroke="var(--color-border)" strokeWidth="0.4" opacity="0.5"/>
          </pattern>
          <clipPath id="island-clip">
            <polygon points={outline}/>
          </clipPath>
        </defs>
        <rect width={width} height={height} fill="url(#topo)" clipPath="url(#island-clip)" opacity="0.5"/>

        {/* Edge paths */}
        {edgePaths}

        {/* Nodes */}
        {resolvedNodes.map((node) => {
          const area = node.area;
          const isSelected = area?.id === selectedAreaId;
          const hasEncounters = (area?.tables.length ?? 0) > 0;
          const completion = area ? getAreaCompletion(area.id) : { caught: 0, total: 0 };
          const nodeR = isSelected ? 10 : 8;

          return (
            <g
              key={node.label}
              className="cursor-pointer"
              onClick={() => area && onSelectArea(area.id)}
              style={{ opacity: area ? 1 : 0.35 }}
            >
              {/* Selection glow */}
              {isSelected && (
                <circle
                  cx={node.x} cy={node.y} r={nodeR + 4}
                  fill={islandColor}
                  opacity="0.2"
                />
              )}

              {/* Node circle */}
              <circle
                cx={node.x} cy={node.y} r={nodeR}
                fill={isSelected ? islandColor : hasEncounters ? 'var(--color-surface)' : 'var(--color-panel)'}
                stroke={isSelected ? islandColor : hasEncounters ? 'var(--color-border)' : 'var(--color-border)'}
                strokeWidth={isSelected ? 2 : 1.5}
              />

              {/* Completion arc ring */}
              <CompletionArc
                cx={node.x} cy={node.y}
                r={nodeR + 3}
                caught={completion.caught}
                total={completion.total}
                color={islandColor}
              />

              {/* Dot inside node */}
              {hasEncounters && !isSelected && (
                <circle cx={node.x} cy={node.y} r={2.5} fill={islandColor} opacity="0.8"/>
              )}

              {/* Label */}
              <text
                x={node.x}
                y={node.y + nodeR + 12}
                textAnchor="middle"
                fontSize="8"
                fontFamily="var(--font-game)"
                fontWeight={isSelected ? '800' : '600'}
                fill={isSelected ? islandColor : 'var(--color-text-muted)'}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
