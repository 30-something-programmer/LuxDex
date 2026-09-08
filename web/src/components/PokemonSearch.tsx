import { useMemo, useState } from 'react';
import type { Area, Encounter, SOSEncounter, TrackStatus } from '../data/types';
import type { PokedexEntry } from '../data/pokedex';
import { getSpriteUrl } from '../data/sprites';
import PokePanel from './PokePanel';

interface PokemonOccurrence {
  areaId: string;
  areaName: string;
  tableLabel: string;
  tableId: string;
  timeOfDay: 'day' | 'night' | 'both';
  rate: number;
  levelMin: number;
  levelMax: number;
  isSOS: boolean;
  sosSlots?: number[];
  encounter: Encounter | SOSEncounter;
}

interface PokemonEntry {
  key: string;
  displayName: string;
  occurrences: PokemonOccurrence[];
}

function buildIndex(areas: Area[]): Map<string, PokemonEntry> {
  const map = new Map<string, PokemonEntry>();
  for (const area of areas) {
    for (const table of area.tables) {
      const addEnc = (enc: Encounter | SOSEncounter, tod: 'day' | 'night', isSOS: boolean) => {
        const entry = map.get(enc.pokemon.key) ?? { key: enc.pokemon.key, displayName: enc.pokemon.displayName, occurrences: [] };
        const sosSlots = 'slots' in enc ? enc.slots : undefined;
        const existingOcc = entry.occurrences.find(o =>
          o.areaId === area.id && o.tableId === table.id && o.isSOS === isSOS && o.rate === enc.rate
        );
        if (existingOcc) {
          if (existingOcc.timeOfDay !== tod) existingOcc.timeOfDay = 'both';
        } else {
          entry.occurrences.push({
            areaId: area.id, areaName: area.primaryName,
            tableLabel: table.label, tableId: table.id,
            timeOfDay: tod, rate: enc.rate,
            levelMin: table.minLevel, levelMax: table.maxLevel,
            isSOS, sosSlots, encounter: enc,
          });
        }
        if (!map.has(enc.pokemon.key)) map.set(enc.pokemon.key, entry);
      };
      for (const enc of table.day) addEnc(enc, 'day', false);
      for (const enc of table.night) addEnc(enc, 'night', false);
      for (const enc of table.sosDayConsolidated) addEnc(enc, 'day', true);
      for (const enc of table.sosNightConsolidated) addEnc(enc, 'night', true);
    }
  }
  return map;
}

function slotLabel(slots: number[] | undefined): string {
  if (!slots || slots.length === 0) return '';
  const sorted = [...slots].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0]; let end = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (sorted[i] === end + 1) { end = sorted[i]; }
    else { ranges.push(start === end ? `${start}` : `${start}–${end}`); start = end = sorted[i]; }
  }
  return `Slots ${ranges.join(', ')}`;
}

interface Props {
  areas: Area[];
  pokedex: PokedexEntry[];
  getStatus: (key: string) => TrackStatus;
  setStatus: (key: string, status: TrackStatus) => void;
  advanceStatus: (key: string) => void;
  initialQuery?: string;
  onGoToArea: (areaId: string) => void;
}

export default function PokemonSearch({ areas, pokedex, getStatus, setStatus, advanceStatus, initialQuery = '', onGoToArea }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [panelEntry, setPanelEntry] = useState<PokemonEntry | null>(null);

  const encounterIndex = useMemo(() => buildIndex(areas), [areas]);

  // Merge pokedex master data with encounter index — pokedex is the authority on what Pokémon exist
  const allEntries = useMemo(() => {
    const merged = new Map<string, PokemonEntry>();
    // Add all Pokédex entries
    for (const dexEntry of pokedex) {
      const enc = encounterIndex.get(dexEntry.key);
      merged.set(dexEntry.key, {
        key: dexEntry.key,
        displayName: dexEntry.name,
        occurrences: enc?.occurrences ?? [],
      });
    }
    // Add any encounter-only entries not in Pokédex (shouldn't happen but be safe)
    for (const [key, enc] of encounterIndex) {
      if (!merged.has(key)) merged.set(key, enc);
    }
    return Array.from(merged.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [pokedex, encounterIndex]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allEntries.slice(0, 80);
    return allEntries.filter(e => e.displayName.toLowerCase().includes(q));
  }, [query, allEntries]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-4 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="font-black text-lg text-[var(--color-text)] mb-3">Pokémon Finder</div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            autoFocus
            placeholder="Search Pokémon..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[var(--color-panel)] text-base font-semibold text-[var(--color-text)] placeholder-[var(--color-text-muted)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 border border-[var(--color-border)]"
          />
        </div>
        {query && <div className="text-xs text-[var(--color-text-muted)] font-medium mt-1.5 px-1">{results.length} result{results.length !== 1 ? 's' : ''}</div>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {results.length === 0 && (
          <div className="text-center text-[var(--color-text-muted)] py-16 font-semibold">No Pokémon found for "{query}"</div>
        )}
        {results.map(entry => {
          const status = getStatus(entry.key);
          const spriteUrl = getSpriteUrl(entry.key);
          const spriteFilter = status === 'unseen' ? 'brightness(0) opacity(0.45)' : status === 'seen' ? 'saturate(0) opacity(0.5)' : 'none';
          const isOwned = status === 'caught';
          const isSeen = status === 'seen';

          return (
            <div key={entry.key} className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-3 py-2.5 bg-[var(--color-panel)]">
                <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
                  <img
                    src={spriteUrl}
                    alt={entry.displayName}
                    className="w-full h-full object-contain"
                    style={{ imageRendering: 'pixelated', filter: spriteFilter }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-base text-[var(--color-text)]">
                    {entry.displayName}
                  </div>
                  <div className={`text-xs font-semibold ${isOwned ? 'text-[var(--color-owned)]' : isSeen ? 'text-[var(--color-seen)]' : 'text-[var(--color-text-muted)]'}`}>
                    {isOwned ? '✓ Owned' : isSeen ? '👁 Seen' : 'Unseen'}
                  </div>
                </div>
                <button
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--color-accent-soft)] text-[var(--color-accent)] hover:opacity-80 transition-opacity"
                  onClick={() => setPanelEntry(entry)}
                >
                  Details
                </button>
              </div>

              {entry.occurrences.length === 0 && (
                <div className="px-3 py-2.5 text-xs text-[var(--color-text-muted)] font-semibold italic">
                  No Penumbra encounter location found
                </div>
              )}
              <div className="divide-y divide-[var(--color-border)]">
                {entry.occurrences.map((occ, i) => (
                  <button
                    key={i}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-panel)]/50 transition-colors"
                    onClick={() => onGoToArea(occ.areaId)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-[var(--color-text)] truncate">{occ.areaName}</div>
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        <span className="text-[10px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>Lv. {occ.levelMin}–{occ.levelMax}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>{occ.rate}%</span>
                        {occ.isSOS && (
                          <span className="text-[10px] font-bold text-[var(--color-sos)] bg-[var(--color-sos)]/10 px-1.5 py-0.5 rounded-full">
                            SOS {slotLabel(occ.sosSlots)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        occ.timeOfDay === 'both' ? 'bg-[var(--color-panel)] text-[var(--color-text)]' :
                        occ.timeOfDay === 'day' ? 'bg-[var(--color-owned-soft)] text-[var(--color-owned)]' :
                        'bg-[var(--color-ulaula)]/10 text-[var(--color-ulaula)]'
                      }`}>
                        {occ.timeOfDay === 'both' ? 'Day & Night' : occ.timeOfDay === 'day' ? '☀ Day' : '☽ Night'}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {panelEntry && (
        <PokePanel
          encounter={panelEntry.occurrences[0]?.encounter ?? null}
          status={getStatus(panelEntry.key)}
          onSetStatus={(s) => setStatus(panelEntry.key, s)}
          onClose={() => setPanelEntry(null)}
          onFindElsewhere={() => setPanelEntry(null)}
        />
      )}
    </div>
  );
}
