import { useMemo, useState } from 'react';
import type { TrackStatus } from '../data/types';
import { getSpriteUrl } from '../data/sprites';
import type { PokedexEntry } from '../data/pokedex';
import PokePanel from './PokePanel';

type SortOrder = 'alola' | 'national' | 'az';
type Filter = 'all' | 'unseen' | 'seen' | 'owned';

interface Props {
  pokedex: PokedexEntry[];
  getStatus: (key: string) => TrackStatus;
  setStatus: (key: string, status: TrackStatus) => void;
  onFindInPenumbra: (name: string) => void;
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

function DexNumber({ n, className }: { n: number | undefined; className?: string }) {
  if (!n) return null;
  return (
    <span className={className} style={{ fontFamily: 'var(--font-mono)' }}>
      #{String(n).padStart(3, '0')}
    </span>
  );
}

export default function PokedexView({ pokedex, getStatus, setStatus, onFindInPenumbra }: Props) {
  const [sort, setSort] = useState<SortOrder>('alola');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [panelEntry, setPanelEntry] = useState<PokedexEntry | null>(null);

  const sorted = useMemo(() => {
    let entries = sort === 'alola'
      ? pokedex.filter(e => e.alolaDex != null).sort((a, b) => (a.alolaDex ?? 9999) - (b.alolaDex ?? 9999))
      : sort === 'national'
      ? [...pokedex].sort((a, b) => a.nationalDex - b.nationalDex)
      : [...pokedex].sort((a, b) => a.name.localeCompare(b.name));
    return entries;
  }, [pokedex, sort]);

  const ownedCount = useMemo(() => pokedex.filter(e => getStatus(e.key) === 'caught').length, [pokedex, getStatus]);
  const seenCount = useMemo(() => pokedex.filter(e => getStatus(e.key) === 'seen').length, [pokedex, getStatus]);

  const filtered = useMemo(() => {
    let entries = sorted;
    if (query.trim()) entries = entries.filter(e => e.name.toLowerCase().includes(query.toLowerCase()));
    if (filter === 'unseen') entries = entries.filter(e => getStatus(e.key) === 'unseen');
    else if (filter === 'seen') entries = entries.filter(e => getStatus(e.key) === 'seen');
    else if (filter === 'owned') entries = entries.filter(e => getStatus(e.key) === 'caught');
    return entries;
  }, [sorted, filter, query, getStatus]);

  const SORTS: { key: SortOrder; label: string }[] = [
    { key: 'alola', label: 'Alola Dex' },
    { key: 'national', label: 'National Dex' },
    { key: 'az', label: 'A–Z' },
  ];
  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unseen', label: 'Unseen' },
    { key: 'seen', label: 'Seen' },
    { key: 'owned', label: 'Owned' },
  ];

  const displayNumber = (e: PokedexEntry) =>
    sort === 'alola' ? e.alolaDex : sort === 'national' ? e.nationalDex : undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] space-y-2.5">
        <div className="flex items-baseline justify-between">
          <div className="font-black text-xl text-[var(--color-text)]">Pokédex</div>
          <div className="text-xs font-semibold text-[var(--color-text-muted)]">
            <span className="text-[var(--color-seen)]">👁 {seenCount}</span>
            <span className="mx-1.5 opacity-40">·</span>
            <span className="text-[var(--color-owned)]">✓ {ownedCount}</span>
            <span className="mx-1.5 opacity-40">·</span>
            <span>{pokedex.length} total</span>
          </div>
        </div>

        {/* Sort selector */}
        <div className="flex gap-1 bg-[var(--color-panel)] rounded-xl p-1">
          {SORTS.map(s => (
            <button
              key={s.key}
              className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                sort === s.key ? 'bg-[var(--color-accent)] text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
              onClick={() => setSort(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                filter === f.key
                  ? f.key === 'owned' ? 'bg-[var(--color-owned-soft)] text-[var(--color-owned)] border-[var(--color-owned)]'
                  : f.key === 'seen' ? 'bg-[var(--color-seen-soft)] text-[var(--color-seen)] border-[var(--color-seen)]'
                  : f.key === 'unseen' ? 'bg-[var(--color-panel)] text-[var(--color-text)] border-[var(--color-border)]'
                  : 'bg-[var(--color-panel)] text-[var(--color-text)] border-[var(--color-border)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search Pokémon..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--color-panel)] text-sm font-semibold text-[var(--color-text)] placeholder-[var(--color-text-muted)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 border border-[var(--color-border)]"
          />
          {query && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--color-text-muted)] font-mono">{filtered.length}</div>
          )}
        </div>
      </div>

      {/* Dense Pokédex grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 && (
          <div className="text-center text-[var(--color-text-muted)] py-16 font-semibold">Nothing here</div>
        )}
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-1.5">
          {filtered.map(entry => {
            const status = getStatus(entry.key);
            const isOwned = status === 'caught';
            const isSeen = status === 'seen';
            const isUnseen = status === 'unseen';
            const spriteUrl = getSpriteUrl(entry.key);
            const spriteFilter = isUnseen
              ? 'brightness(0) opacity(0.5)'
              : isSeen
              ? 'saturate(0) opacity(0.45)'
              : 'none';
            const num = displayNumber(entry);

            return (
              <button
                key={entry.key}
                className={`relative flex flex-col items-center rounded-xl p-1.5 text-left transition-all duration-100 select-none hover:shadow-lg hover:-translate-y-0.5 ${
                  isOwned ? 'ring-2 ring-[var(--color-owned)] bg-[var(--color-owned-soft)]' :
                  isSeen ? 'ring-1 ring-[var(--color-seen)] bg-[var(--color-seen-soft)]' :
                  'ring-1 ring-[var(--color-border)] bg-[var(--color-surface)]'
                }`}
                onClick={() => setPanelEntry(entry)}
              >
                {/* Owned badge */}
                {isOwned && <PokeBall className="absolute top-0.5 right-0.5 w-3.5 h-3.5 z-10"/>}
                {isSeen && (
                  <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--color-seen)] flex items-center justify-center z-10">
                    <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                  </div>
                )}

                {/* Dex number */}
                {num != null && (
                  <div className="text-[8px] font-bold text-[var(--color-text-muted)] leading-none mb-0.5 w-full text-center" style={{ fontFamily: 'var(--font-mono)' }}>
                    #{String(num).padStart(3, '0')}
                  </div>
                )}

                {/* Sprite */}
                <div className="w-11 h-11 flex items-center justify-center">
                  <img
                    src={spriteUrl}
                    alt={entry.name}
                    className="w-full h-full object-contain"
                    style={{ imageRendering: 'pixelated', filter: spriteFilter }}
                  />
                </div>

                {/* Name */}
                <div className="text-[9px] font-bold text-center leading-tight mt-0.5 truncate w-full px-0.5" style={{ color: isUnseen ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
                  {entry.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      {panelEntry && (
        <DexEntryPanel
          entry={panelEntry}
          status={getStatus(panelEntry.key)}
          onSetStatus={(s) => setStatus(panelEntry.key, s)}
          onClose={() => setPanelEntry(null)}
          onFindInPenumbra={() => { setPanelEntry(null); onFindInPenumbra(panelEntry.name); }}
        />
      )}
    </div>
  );
}

// Dedicated dex entry panel with both dex numbers + Find in Penumbra
function DexEntryPanel({ entry, status, onSetStatus, onClose, onFindInPenumbra }: {
  entry: PokedexEntry;
  status: TrackStatus;
  onSetStatus: (s: TrackStatus) => void;
  onClose: () => void;
  onFindInPenumbra: () => void;
}) {
  const spriteUrl = getSpriteUrl(entry.key);
  const isOwned = status === 'caught';
  const isSeen = status === 'seen';
  const spriteFilter = status === 'unseen' ? 'brightness(0) opacity(0.4)' : status === 'seen' ? 'saturate(0) opacity(0.5)' : 'none';
  const statusLabel = isOwned ? 'Owned' : isSeen ? 'Seen' : 'Unseen';
  const statusColor = isOwned ? 'text-[var(--color-owned)]' : isSeen ? 'text-[var(--color-seen)]' : 'text-[var(--color-text-muted)]';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
      <div
        className="relative z-10 bg-[var(--color-surface)] rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm mx-0 sm:mx-4 shadow-2xl border border-[var(--color-border)] p-5"
        onClick={e => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--color-panel)] flex items-center justify-center hover:bg-[var(--color-panel-hover)] transition-colors"
          onClick={onClose}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-20 h-20 bg-[var(--color-panel)] rounded-2xl flex items-center justify-center flex-shrink-0">
            <img
              src={spriteUrl}
              alt={entry.name}
              className="w-16 h-16 object-contain"
              style={{ imageRendering: 'pixelated', filter: spriteFilter }}
            />
            {isOwned && (
              <svg className="absolute -bottom-1 -right-1 w-6 h-6" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" fill="var(--color-owned)" stroke="white" strokeWidth="1.5"/>
                <path d="M1.5 10h17" stroke="white" strokeWidth="1.5"/>
                <circle cx="10" cy="10" r="3" fill="white" stroke="white" strokeWidth="1"/>
                <circle cx="10" cy="10" r="1.5" fill="var(--color-owned)"/>
              </svg>
            )}
          </div>
          <div>
            <div className="font-black text-xl text-[var(--color-text)]">
              {entry.name}
            </div>
            <div className={`text-sm font-bold ${statusColor}`}>{statusLabel}</div>
          </div>
        </div>

        {/* Dex numbers */}
        <div className="mb-4 p-3 rounded-xl bg-[var(--color-panel)] grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">Alola Dex</div>
            {entry.alolaDex != null ? (
              <div className="font-black text-base text-[var(--color-text)]" style={{ fontFamily: 'var(--font-mono)' }}>
                #{String(entry.alolaDex).padStart(3, '0')}
              </div>
            ) : (
              <div className="text-sm font-semibold text-[var(--color-text-muted)]">—</div>
            )}
          </div>
          <div>
            <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">National Dex</div>
            <div className="font-black text-base text-[var(--color-text)]" style={{ fontFamily: 'var(--font-mono)' }}>
              #{String(entry.nationalDex).padStart(3, '0')}
            </div>
          </div>
          {entry.generation && (
            <div className="col-span-2">
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">Generation</div>
              <div className="text-sm font-semibold text-[var(--color-text)]">Gen {entry.generation}</div>
            </div>
          )}
        </div>

        {/* Status actions */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
              isSeen || isOwned
                ? 'bg-[var(--color-seen)] text-white'
                : 'bg-[var(--color-seen-soft)] text-[var(--color-seen)] hover:opacity-80'
            }`}
            onClick={() => onSetStatus('seen')}
            disabled={isOwned}
          >
            👁 {isSeen || isOwned ? 'Seen ✓' : 'Mark Seen'}
          </button>
          <button
            className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
              isOwned
                ? 'bg-[var(--color-owned)] text-[var(--color-bg)]'
                : 'bg-[var(--color-owned-soft)] text-[var(--color-owned)] hover:opacity-80'
            }`}
            onClick={() => onSetStatus('caught')}
          >
            {isOwned ? '✓ Owned' : 'Mark Owned'}
          </button>
        </div>

        <div className="flex gap-2">
          {status !== 'unseen' && (
            <button
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-[var(--color-text-muted)] bg-[var(--color-panel)] hover:bg-[var(--color-panel-hover)] transition-colors"
              onClick={() => onSetStatus('unseen')}
            >
              Reset
            </button>
          )}
          <button
            className="flex-1 py-2 rounded-xl text-xs font-black text-white bg-[var(--color-accent)] hover:opacity-85 transition-opacity"
            onClick={onFindInPenumbra}
          >
            Find in Penumbra →
          </button>
        </div>
      </div>
    </div>
  );
}
