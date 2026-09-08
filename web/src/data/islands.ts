export type IslandId = 'melemele' | 'akala' | 'ulaula' | 'poni' | 'other';

export interface IslandInfo {
  id: IslandId;
  name: string;
  fullName: string;
  color: string;
}

export const ISLANDS: IslandInfo[] = [
  { id: 'melemele', name: "Mele­mele", fullName: "Melemele Island", color: 'var(--color-melemele)' },
  { id: 'akala',    name: "Akala",    fullName: "Akala Island",    color: 'var(--color-akala)' },
  { id: 'ulaula',   name: "Ula'ula",  fullName: "Ula'ula Island",  color: 'var(--color-ulaula)' },
  { id: 'poni',     name: "Poni",     fullName: "Poni Island",     color: 'var(--color-poni)' },
  { id: 'other',    name: "Other",    fullName: "Other Areas",     color: 'var(--color-text-muted)' },
];

// Map area name patterns → island
const ISLAND_PATTERNS: Array<{ island: IslandId; patterns: RegExp[] }> = [
  {
    island: 'melemele',
    patterns: [
      /route\s*1\b/i, /route\s*2\b/i, /route\s*3\b/i,
      /iki\s*town/i, /hau.?oli/i, /melemele/i, /kala.?e\s*bay/i,
      /verdant\s*cavern/i, /ten\s*carat/i, /seaward\s*cave/i,
      /big\s*wave\s*beach/i,
    ],
  },
  {
    island: 'akala',
    patterns: [
      /route\s*4\b/i, /route\s*5\b/i, /route\s*6\b/i,
      /route\s*7\b/i, /route\s*8\b/i, /route\s*9\b/i,
      /heahea/i, /paniola/i, /brooklet/i, /wela\s*volcano/i,
      /royal\s*avenue/i, /lush\s*jungle/i, /memorial\s*hill/i,
      /konikoni/i, /akala\s*outskirts/i, /diglett.s\s*tunnel/i,
    ],
  },
  {
    island: 'ulaula',
    patterns: [
      /route\s*10\b/i, /route\s*11\b/i, /route\s*12\b/i,
      /route\s*13\b/i, /route\s*14\b/i, /route\s*15\b/i,
      /route\s*16\b/i,
      /malie/i, /mount\s*hokulani/i, /po\s*town/i, /tapu\s*village/i,
      /ula.ula\s*meadow/i, /haina\s*desert/i, /aether\s*house/i,
      /mount\s*lanakila/i, /lake\s*of\s*the\s*moone/i,
    ],
  },
  {
    island: 'poni',
    patterns: [
      /route\s*17\b/i, /route\s*18\b/i,
      /poni/i, /seafolk/i, /exeggutor\s*island/i,
      /vast\s*poni\s*canyon/i, /resolution\s*cave/i,
    ],
  },
];

export function getIslandForArea(primaryName: string): IslandId {
  for (const { island, patterns } of ISLAND_PATTERNS) {
    if (patterns.some(p => p.test(primaryName))) return island;
  }
  return 'other';
}

// Habitat zone labels: infer a friendlier label from table index and area name
export function habitatLabel(tableIndex: number, totalTables: number, areaName: string): string {
  const lower = areaName.toLowerCase();
  if (totalTables === 1) return 'Encounter Zone';
  // Try context-aware labeling for common patterns
  if (lower.includes('sea') || lower.includes('bay') || lower.includes('beach') || lower.includes('shore')) {
    const water = ['Surfing', 'Fishing (Old Rod)', 'Fishing (Super Rod)'];
    return water[tableIndex] ?? `Zone ${tableIndex + 1}`;
  }
  if (lower.includes('cave') || lower.includes('cavern') || lower.includes('tunnel')) {
    const cave = ['Cave Floor', 'Rock Smash', 'Cave Water'];
    return cave[tableIndex] ?? `Zone ${tableIndex + 1}`;
  }
  if (lower.includes('route') || lower.includes('outskirts') || lower.includes('meadow') || lower.includes('plains')) {
    const route = ['Tall Grass', 'Short Grass', 'Surfing', 'Fishing'];
    return route[tableIndex] ?? `Zone ${tableIndex + 1}`;
  }
  const ZONE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  return `Zone ${ZONE_LETTERS[tableIndex] ?? tableIndex + 1}`;
}

// Schematic node positions for island maps (x,y as % of SVG viewbox 0-100)
export interface MapNode {
  areaNamePattern: RegExp;
  label: string;
  x: number;
  y: number;
}

// Paths between nodes as pairs of area name patterns (for drawing route lines)
export interface MapEdge {
  from: RegExp;
  to: RegExp;
}

export interface IslandMapData {
  island: IslandId;
  // SVG viewBox dimensions
  width: number;
  height: number;
  // Island silhouette polygon points "x,y x,y ..."
  outline: string;
  nodes: MapNode[];
  edges: MapEdge[];
}

export const ISLAND_MAPS: IslandMapData[] = [
  {
    island: 'melemele',
    width: 280, height: 260,
    outline: '60,10 130,5 190,20 230,60 240,110 220,160 200,200 170,240 130,250 90,245 60,220 35,185 20,145 15,100 25,60',
    nodes: [
      { areaNamePattern: /iki\s*town/i,         label: "Iki Town",          x: 130, y: 42  },
      { areaNamePattern: /hau.?oli\s*outkirts|route\s*1\b/i, label: "Route 1", x: 125, y: 90  },
      { areaNamePattern: /hau.?oli\s*city/i,    label: "Hau'oli City",      x: 70,  y: 125 },
      { areaNamePattern: /route\s*2\b/i,        label: "Route 2",           x: 60,  y: 168 },
      { areaNamePattern: /route\s*3\b/i,        label: "Route 3",           x: 175, y: 105 },
      { areaNamePattern: /kala.?e\s*bay/i,      label: "Kala'e Bay",        x: 60,  y: 215 },
      { areaNamePattern: /ten\s*carat/i,        label: "Ten Carat Hill",    x: 35,  y: 145 },
      { areaNamePattern: /verdant\s*cavern/i,   label: "Verdant Cavern",    x: 45,  y: 200 },
      { areaNamePattern: /melemele\s*sea/i,     label: "Melemele Sea",      x: 195, y: 180 },
      { areaNamePattern: /hau.?oli\s*cemetery/i, label: "Cemetery",          x: 90,  y: 110 },
      { areaNamePattern: /hau.?oli\s*outskirts/i, label: "Outskirts",       x: 115, y: 80  },
    ],
    edges: [
      { from: /iki\s*town/i,       to: /route\s*1\b/i },
      { from: /route\s*1\b/i,      to: /hau.?oli\s*city/i },
      { from: /hau.?oli\s*city/i,  to: /route\s*2\b/i },
      { from: /route\s*1\b/i,      to: /route\s*3\b/i },
      { from: /route\s*2\b/i,      to: /kala.?e\s*bay/i },
    ],
  },
  {
    island: 'akala',
    width: 300, height: 280,
    outline: '80,10 160,5 220,25 265,70 275,130 260,185 235,225 195,255 150,268 100,262 65,235 40,195 25,145 30,90 50,45',
    nodes: [
      { areaNamePattern: /heahea/i,             label: "Heahea City",       x: 235, y: 90  },
      { areaNamePattern: /route\s*4\b/i,        label: "Route 4",           x: 185, y: 55  },
      { areaNamePattern: /paniola\s*town/i,     label: "Paniola Town",      x: 140, y: 95  },
      { areaNamePattern: /paniola\s*ranch/i,    label: "Paniola Ranch",     x: 120, y: 65  },
      { areaNamePattern: /route\s*5\b/i,        label: "Route 5",           x: 90,  y: 110 },
      { areaNamePattern: /brooklet/i,           label: "Brooklet Hill",     x: 65,  y: 140 },
      { areaNamePattern: /route\s*6\b/i,        label: "Route 6",           x: 100, y: 155 },
      { areaNamePattern: /royal\s*avenue/i,     label: "Royal Avenue",      x: 130, y: 175 },
      { areaNamePattern: /route\s*7\b/i,        label: "Route 7",           x: 90,  y: 200 },
      { areaNamePattern: /wela\s*volcano/i,     label: "Wela Volcano",      x: 190, y: 140 },
      { areaNamePattern: /route\s*8\b/i,        label: "Route 8",           x: 155, y: 215 },
      { areaNamePattern: /lush\s*jungle/i,      label: "Lush Jungle",       x: 120, y: 230 },
      { areaNamePattern: /memorial\s*hill/i,    label: "Memorial Hill",     x: 175, y: 245 },
      { areaNamePattern: /konikoni/i,           label: "Konikoni City",     x: 215, y: 235 },
      { areaNamePattern: /route\s*9\b/i,        label: "Route 9",           x: 240, y: 185 },
      { areaNamePattern: /akala\s*outskirts/i,  label: "Akala Outskirts",   x: 255, y: 130 },
    ],
    edges: [
      { from: /heahea/i,           to: /route\s*4\b/i },
      { from: /route\s*4\b/i,      to: /paniola\s*town/i },
      { from: /paniola\s*town/i,   to: /route\s*5\b/i },
      { from: /route\s*5\b/i,      to: /brooklet/i },
      { from: /paniola\s*town/i,   to: /route\s*6\b/i },
      { from: /route\s*6\b/i,      to: /royal\s*avenue/i },
      { from: /royal\s*avenue/i,   to: /route\s*7\b/i },
      { from: /route\s*7\b/i,      to: /lush\s*jungle/i },
      { from: /lush\s*jungle/i,    to: /route\s*8\b/i },
      { from: /route\s*8\b/i,      to: /konikoni/i },
      { from: /konikoni/i,         to: /route\s*9\b/i },
      { from: /route\s*9\b/i,      to: /heahea/i },
      { from: /heahea/i,           to: /akala\s*outskirts/i },
    ],
  },
  {
    island: 'ulaula',
    width: 310, height: 290,
    outline: '100,8 175,5 240,25 280,70 295,135 280,195 255,240 210,268 155,278 95,270 55,240 30,195 20,140 30,85 60,40',
    nodes: [
      { areaNamePattern: /malie\s*city/i,       label: "Malie City",        x: 90,  y: 45  },
      { areaNamePattern: /malie\s*garden/i,     label: "Malie Garden",      x: 118, y: 62  },
      { areaNamePattern: /route\s*10\b/i,       label: "Route 10",          x: 160, y: 55  },
      { areaNamePattern: /mount\s*hokulani/i,   label: "Mt. Hokulani",      x: 205, y: 50  },
      { areaNamePattern: /route\s*11\b/i,       label: "Route 11",          x: 250, y: 90  },
      { areaNamePattern: /route\s*12\b/i,       label: "Route 12",          x: 260, y: 140 },
      { areaNamePattern: /route\s*13\b/i,       label: "Route 13",          x: 240, y: 190 },
      { areaNamePattern: /haina\s*desert/i,     label: "Haina Desert",      x: 155, y: 150 },
      { areaNamePattern: /route\s*14\b/i,       label: "Route 14",          x: 195, y: 230 },
      { areaNamePattern: /tapu\s*village/i,     label: "Tapu Village",      x: 145, y: 240 },
      { areaNamePattern: /route\s*15\b/i,       label: "Route 15",          x: 100, y: 230 },
      { areaNamePattern: /po\s*town/i,          label: "Po Town",           x: 70,  y: 175 },
      { areaNamePattern: /route\s*16\b/i,       label: "Route 16",          x: 60,  y: 120 },
      { areaNamePattern: /ula.ula\s*meadow/i,   label: "Ula'ula Meadow",    x: 90,  y: 210 },
      { areaNamePattern: /aether\s*house/i,     label: "Aether House",      x: 135, y: 200 },
    ],
    edges: [
      { from: /malie\s*city/i,     to: /route\s*10\b/i },
      { from: /route\s*10\b/i,     to: /mount\s*hokulani/i },
      { from: /mount\s*hokulani/i, to: /route\s*11\b/i },
      { from: /route\s*11\b/i,     to: /route\s*12\b/i },
      { from: /route\s*12\b/i,     to: /route\s*13\b/i },
      { from: /route\s*13\b/i,     to: /route\s*14\b/i },
      { from: /route\s*14\b/i,     to: /tapu\s*village/i },
      { from: /tapu\s*village/i,   to: /route\s*15\b/i },
      { from: /route\s*15\b/i,     to: /po\s*town/i },
      { from: /po\s*town/i,        to: /route\s*16\b/i },
      { from: /route\s*16\b/i,     to: /malie\s*city/i },
    ],
  },
  {
    island: 'poni',
    width: 270, height: 260,
    outline: '80,12 150,8 205,30 240,75 248,130 235,180 210,218 170,245 120,252 75,238 45,200 30,155 30,105 50,60',
    nodes: [
      { areaNamePattern: /route\s*17\b/i,       label: "Route 17",          x: 80,  y: 55  },
      { areaNamePattern: /seafolk/i,            label: "Seafolk Village",   x: 140, y: 50  },
      { areaNamePattern: /route\s*18\b/i,       label: "Route 18",          x: 195, y: 75  },
      { areaNamePattern: /poni\s*wilds/i,       label: "Poni Wilds",        x: 65,  y: 105 },
      { areaNamePattern: /poni\s*plains/i,      label: "Poni Plains",       x: 140, y: 100 },
      { areaNamePattern: /poni\s*grove/i,       label: "Poni Grove",        x: 200, y: 125 },
      { areaNamePattern: /poni\s*coast/i,       label: "Poni Coast",        x: 215, y: 170 },
      { areaNamePattern: /poni\s*gauntlet/i,    label: "Poni Gauntlet",     x: 175, y: 200 },
      { areaNamePattern: /vast\s*poni\s*canyon/i, label: "Vast Poni Canyon",x: 120, y: 170 },
      { areaNamePattern: /poni\s*meadow/i,      label: "Poni Meadow",       x: 80,  y: 200 },
      { areaNamePattern: /resolution\s*cave/i,  label: "Resolution Cave",   x: 80,  y: 235 },
      { areaNamePattern: /exeggutor\s*island/i, label: "Exeggutor Is.",     x: 210, y: 220 },
    ],
    edges: [
      { from: /seafolk/i,           to: /route\s*17\b/i },
      { from: /seafolk/i,           to: /route\s*18\b/i },
      { from: /route\s*17\b/i,      to: /poni\s*wilds/i },
      { from: /poni\s*wilds/i,      to: /poni\s*plains/i },
      { from: /poni\s*plains/i,     to: /poni\s*grove/i },
      { from: /poni\s*grove/i,      to: /poni\s*coast/i },
      { from: /poni\s*coast/i,      to: /poni\s*gauntlet/i },
      { from: /poni\s*gauntlet/i,   to: /vast\s*poni\s*canyon/i },
      { from: /vast\s*poni\s*canyon/i, to: /poni\s*meadow/i },
      { from: /poni\s*meadow/i,     to: /resolution\s*cave/i },
    ],
  },
];
