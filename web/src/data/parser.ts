import type { Area, Encounter, EncounterTable, MapRecord, PokemonIdentity, SOSEncounter } from './types';

// Form display name overrides
const FORM_DISPLAY: Record<string, string> = {
  'rattata:forme-1': 'Alolan Rattata',
  'raticate:forme-1': 'Alolan Raticate',
  'raichu:forme-1': 'Alolan Raichu',
  'sandshrew:forme-1': 'Alolan Sandshrew',
  'sandslash:forme-1': 'Alolan Sandslash',
  'vulpix:forme-1': 'Alolan Vulpix',
  'ninetales:forme-1': 'Alolan Ninetales',
  'diglett:forme-1': 'Alolan Diglett',
  'dugtrio:forme-1': 'Alolan Dugtrio',
  'meowth:forme-1': 'Alolan Meowth',
  'persian:forme-1': 'Alolan Persian',
  'geodude:forme-1': 'Alolan Geodude',
  'graveler:forme-1': 'Alolan Graveler',
  'golem:forme-1': 'Alolan Golem',
  'grimer:forme-1': 'Alolan Grimer',
  'muk:forme-1': 'Alolan Muk',
  'exeggutor:forme-1': 'Alolan Exeggutor',
  'marowak:forme-1': 'Alolan Marowak',
};

function makePokemonKey(species: string, form?: string): string {
  const base = species.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (form) {
    const formPart = form.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `${base}:${formPart}`;
  }
  return base;
}

function parsePokemonIdentity(raw: string): PokemonIdentity | null {
  const noneMatch = raw.match(/^\(None\)/);
  if (noneMatch) return null;

  const formMatch = raw.match(/^(.+?)\s+\(Forme (\d+)\)$/);
  if (formMatch) {
    const species = formMatch[1].trim();
    const form = `forme-${formMatch[2]}`;
    const key = makePokemonKey(species, form);
    const displayName = FORM_DISPLAY[key] ?? `${species} (Forme ${formMatch[2]})`;
    return { key, displayName, sourceName: raw.trim(), form };
  }

  const key = makePokemonKey(raw.trim());
  return { key, displayName: raw.trim(), sourceName: raw.trim() };
}

function parseEncounterList(text: string, minLevel: number, maxLevel: number): Encounter[] {
  const encounters: Encounter[] = [];
  const parts = text.split(',').map(s => s.trim());
  for (const part of parts) {
    const m = part.match(/^(.+?)\s+\((\d+)%\)$/);
    if (!m) continue;
    const identity = parsePokemonIdentity(m[1].trim());
    if (!identity) continue;
    encounters.push({ pokemon: identity, rate: parseInt(m[2], 10), minLevel, maxLevel });
  }
  return encounters;
}

function parseLevelRange(text: string): { min: number; max: number } {
  const m = text.match(/Levels? (\d+)-(\d+)/);
  if (m) return { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };
  const single = text.match(/Levels? (\d+)/);
  if (single) { const n = parseInt(single[1], 10); return { min: n, max: n }; }
  return { min: 0, max: 0 };
}

function consolidateSOS(slotData: Array<{ slot: number; encounters: Encounter[] }>): SOSEncounter[] {
  const map = new Map<string, SOSEncounter>();
  for (const { slot, encounters } of slotData) {
    for (const enc of encounters) {
      const existing = map.get(enc.pokemon.key);
      if (existing && existing.rate === enc.rate) {
        existing.slots.push(slot);
      } else if (!existing) {
        map.set(enc.pokemon.key, { ...enc, slots: [slot] });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.rate - a.rate);
}

function parseMapBlock(block: string): MapRecord | null {
  const lines = block.split('\n').map(s => s.trimEnd());
  const mapLine = lines.find(l => l.startsWith('Map:'));
  if (!mapLine) return null;

  // Parse map IDs and location names from "Map: 000 - Name / 003 - Name"
  const mapIdsRaw = mapLine.replace('Map:', '').trim();
  const segments = mapIdsRaw.split('/').map(s => s.trim());
  const mapIds: number[] = [];
  const locationNames: string[] = [];

  for (const seg of segments) {
    const m = seg.match(/^(\d+)\s+-\s+(.+)$/);
    if (m) {
      mapIds.push(parseInt(m[1], 10));
      const name = m[2].trim();
      if (!locationNames.includes(name)) locationNames.push(name);
    }
  }

  if (locationNames.length === 0) return null;
  const primaryName = locationNames[0];

  // Split into table chunks
  const tableChunks: string[] = [];
  let current = '';
  for (const line of lines.slice(2)) {
    if (line.match(/^Table \d+ \((Day|Night)\):/)) {
      if (current.trim()) tableChunks.push(current);
      current = line + '\n';
    } else {
      current += line + '\n';
    }
  }
  if (current.trim()) tableChunks.push(current);

  // Group chunks by table number
  const tableMap = new Map<number, { day?: string; night?: string }>();
  for (const chunk of tableChunks) {
    const header = chunk.match(/^Table (\d+) \((Day|Night)\):/);
    if (!header) continue;
    const num = parseInt(header[1], 10);
    const tod = header[2].toLowerCase() as 'day' | 'night';
    const entry = tableMap.get(num) ?? {};
    entry[tod] = chunk;
    tableMap.set(num, entry);
  }

  const tables: EncounterTable[] = [];
  for (const [num, { day, night }] of tableMap) {
    const parseHalf = (chunk: string | undefined) => {
      if (!chunk) return { encounters: [], sosSlots: [] as Array<{ slot: number; encounters: Encounter[] }>, min: 0, max: 0 };
      const encLine = chunk.match(/Encounters \((.+?)\):\s*(.+)/);
      const levelInfo = encLine ? parseLevelRange(encLine[1]) : { min: 0, max: 0 };
      const encounters = encLine ? parseEncounterList(encLine[2], levelInfo.min, levelInfo.max) : [];

      const sosSlots: Array<{ slot: number; encounters: Encounter[] }> = [];
      const sosPattern = /SOS Slot (\d+) \((.+?)\):\s*(.+)/g;
      let sosMatch;
      while ((sosMatch = sosPattern.exec(chunk)) !== null) {
        const slotNum = parseInt(sosMatch[1], 10);
        const lvl = parseLevelRange(sosMatch[2]);
        const sosEncs = parseEncounterList(sosMatch[3], lvl.min, lvl.max);
        sosSlots.push({ slot: slotNum, encounters: sosEncs });
      }

      // Additional SOS encounters
      const addSOS = chunk.match(/Additional SOS encounters:\s*(.+)/);
      if (addSOS && addSOS[1].trim() !== '(None)') {
        const lvl = levelInfo;
        const addEncs = parseEncounterList(addSOS[1], lvl.min, lvl.max);
        if (addEncs.length > 0) sosSlots.push({ slot: 0, encounters: addEncs });
      }

      return { encounters, sosSlots, min: levelInfo.min, max: levelInfo.max };
    };

    const d = parseHalf(day);
    const n = parseHalf(night);
    const minLevel = d.min || n.min;
    const maxLevel = d.max || n.max;

    tables.push({
      id: `table-${num}`,
      label: `Table ${num}`,
      minLevel,
      maxLevel,
      day: d.encounters,
      night: n.encounters,
      sosDayConsolidated: consolidateSOS(d.sosSlots),
      sosNightConsolidated: consolidateSOS(n.sosSlots),
    });
  }

  return { mapIds, locationNames, primaryName, tables };
}

export function parseRawData(raw: string): Area[] {
  // Normalize CRLF to LF before parsing
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/^={5,}$/m).map(b => b.trim()).filter(Boolean);
  const records: MapRecord[] = [];

  for (const block of blocks) {
    const record = parseMapBlock(block);
    if (record) records.push(record);
  }

  // Merge records that share location names into logical areas
  // Key by primaryName for grouping — multiple map records can share a name
  const areaMap = new Map<string, Area>();

  for (const record of records) {
    // Skip records with no tables (empty areas) but still include them for browsing
    const key = record.primaryName;
    const existing = areaMap.get(key);
    if (existing) {
      // Merge: add any new tables
      for (const t of record.tables) {
        if (!existing.tables.find(et => et.id === t.id)) {
          existing.tables.push(t);
        }
      }
      for (const id of record.mapIds) {
        if (!existing.mapIds.includes(id)) existing.mapIds.push(id);
      }
      for (const name of record.locationNames) {
        if (!existing.allNames.includes(name)) existing.allNames.push(name);
      }
    } else {
      const id = record.primaryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      areaMap.set(key, {
        id,
        primaryName: record.primaryName,
        allNames: [...record.locationNames],
        mapIds: [...record.mapIds],
        tables: [...record.tables],
      });
    }
  }

  return Array.from(areaMap.values()).sort((a, b) => {
    const minIdA = Math.min(...a.mapIds);
    const minIdB = Math.min(...b.mapIds);
    return minIdA - minIdB;
  });
}
