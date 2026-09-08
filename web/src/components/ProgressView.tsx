import { useMemo, useState } from 'react';
import type { Area, Encounter, SOSEncounter, TrackStatus } from '../data/types';
import { getSpriteUrl } from '../data/sprites';
import PokePanel from './PokePanel';

type Filter = 'all' | 'unseen' | 'seen' | 'owned';

interface PokemonEntry {
  key: string;
  displayName: string;
  encounter: Encounter | SOSEncounter;
}

function buildDex(areas: Area[]): PokemonEntry[] {
  const seen = new Map<string, PokemonEntry>();
  for (const area of areas) {
    for (const table of area.tables) {
      const all: Array<Encounter | SOSEncounter> = [
        ...table.day, ...table.night,
        ...table.sosDayConsolidated, ...table.sosNightConsolidated,
      ];
      for (const enc of all) {
        if (!seen.has(enc.pokemon.key)) {
          seen.set(enc.pokemon.key, { key: enc.pokemon.key, displayName: enc.pokemon.displayName, encounter: enc });
        }
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

interface Props {
  areas: Area[];
  getStatus: (key: string) => TrackStatus;
  setStatus: (key: string, status: TrackStatus) => void;
  advanceStatus: (key: string) => void;
}

function PokeBall({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill="var(--color-owned)" stroke="white" strokeWidth="1.5"/>
      <path d="M1.5 10h17" stroke="white" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="3" fill="white" stroke="white" strokeWidth="1"/>
      <circle cx="10" cy="10" r="1.5" fill="var(--color-owned)"/>
    </svg>
  );
}

export default function ProgressView({ areas, getStatus, setStatus, advanceStatus }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [panelEntry, setPanelEntry] = useState<PokemonEntry | null>(null);

  const dex = useMemo(() => buildDex(areas), [areas]);
  const ownedCount = useMemo(() => dex.filter(e => getStatus(e.key) === 'caught').length, [dex, getStatus]);
  const seenCount = useMemo(() => dex.filter(e => getStatus(e.key) === 'seen').length, [dex, getStatus]);

  const filtered = useMemo(() => {
    let entries = dex;
    if (query.trim()) entries = entries.filter(e => e.displayName.toLowerCase().includes(query.toLowerCase()));
    if (filter === 'unseen') entries = entries.filter(e => getStatus(e.key) === 'unseen');
    else if (filter === 'seen') entries = entries.filter(e => getStatus(e.key) === 'seen');
    else if (filter === 'owned') entries = entries.filter(e => getStatus(e.key) === 'caught');
    return entries;
  }, [dex, filter, query, getStatus]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unseen', label: 'Unseen' },
    { key: 'seen', label: 'Seen' },
    { key: 'owned', label: 'Owned' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-4 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="font-black text-lg text-[var(--color-text)] mb-1">Collection</div>
        <div className="flex gap-3 text-sm font-semibold mb-3">
          <span className="text-[var(--color-text-muted)]">{dex.length} in Penumbra</span>
          <span className="text-[var(--color-seen)]">👁 {seenCount} seen</span>
          <span className="text-[var(--color-owned)]">✓ {ownedCount} owned</span>
        </div>

        <div className="flex gap-1 mb-3 bg-[var(--color-panel)] rounded-xl p-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === f.key ? 'bg-[var(--color-accent)] text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Filter by name..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--color-panel)] text-sm font-semibold text-[var(--color-text)] placeholder-[var(--color-text-muted)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 border border-[var(--color-border)]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 && (
          <div className="text-center text-[var(--color-text-muted)] py-16 font-semibold">Nothing here yet</div>
        )}
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-1.5">
          {filtered.map(entry => {
            const status = getStatus(entry.key);
            const isOwned = status === 'caught';
            const isSeen = status === 'seen';
            const spriteUrl = getSpriteUrl(entry.key);
            const spriteFilter = status === 'unseen' ? 'brightness(0) opacity(0.5)' : status === 'seen' ? 'saturate(0) opacity(0.45)' : 'none';

            return (
              <div
                key={entry.key}
                className={`relative flex flex-col items-center rounded-xl p-1.5 cursor-pointer select-none transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                  isOwned ? 'ring-2 ring-[var(--color-owned)] bg-[var(--color-owned-soft)]' :
                  isSeen ? 'ring-1 ring-[var(--color-seen)] bg-[var(--color-seen-soft)]' :
                  'ring-1 ring-[var(--color-border)] bg-[var(--color-surface)]'
                }`}
                onClick={() => setPanelEntry(entry)}
              >
                {isOwned && <PokeBall className="absolute top-0.5 right-0.5 w-3.5 h-3.5"/>}
                {isSeen && !isOwned && (
                  <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--color-seen)] flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                  </div>
                )}
                <div className="w-11 h-11 flex items-center justify-center">
                  <img
                    src={spriteUrl}
                    alt={entry.displayName}
                    className="w-full h-full object-contain"
                    style={{ imageRendering: 'pixelated', filter: spriteFilter }}
                  />
                </div>
                <div className="text-[9px] font-bold text-center text-[var(--color-text)] leading-tight mt-0.5 truncate w-full px-0.5">
                  {entry.displayName}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {panelEntry && (
        <PokePanel
          encounter={panelEntry.encounter}
          status={getStatus(panelEntry.key)}
          onSetStatus={(s) => setStatus(panelEntry.key, s)}
          onClose={() => setPanelEntry(null)}
          onFindElsewhere={() => setPanelEntry(null)}
        />
      )}
    </div>
  );
}
