import { useState } from 'react';
import type { Area, Encounter, SOSEncounter, TrackStatus } from '../data/types';
import { habitatLabel } from '../data/islands';
import { getSpriteUrl } from '../data/sprites';
import PokeTile from './PokeTile';

interface Props {
  area: Area;
  timeOfDay: 'day' | 'night';
  sosMode: boolean;
  getStatus: (key: string) => TrackStatus;
  advanceStatus: (key: string) => void;
  onPokemonClick: (enc: Encounter | SOSEncounter, tableIdx: number) => void;
}

// Zones whose habitatLabel falls back to "Zone X" are unknown/unmapped
function isNamedZone(label: string): boolean {
  return !/^Zone [A-Z]$/.test(label);
}

function slotLabel(slots: number[]): string {
  if (slots.length === 0) return 'Extra';
  const sorted = [...slots].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0]; let end = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (sorted[i] === end + 1) { end = sorted[i]; }
    else { ranges.push(start === end ? `${start}` : `${start}–${end}`); start = end = sorted[i]; }
  }
  return `Slot ${ranges.join(', ')}`;
}

function SOSTile({ enc, status, onAdvance, onClick }: {
  enc: SOSEncounter;
  status: TrackStatus;
  onAdvance: () => void;
  onClick: () => void;
}) {
  const isRare = enc.rate <= 1;
  const isOwned = status === 'caught';
  const isSeen = status === 'seen';
  const spriteFilter = status === 'unseen' ? 'brightness(0) opacity(0.5)' : status === 'seen' ? 'saturate(0) opacity(0.5)' : 'none';

  return (
    <div
      className={`relative flex flex-col items-center rounded-xl p-1.5 cursor-pointer select-none shadow-sm hover:shadow-md transition-all ${
        isRare ? 'ring-2 ring-[var(--color-sos-rare)]' : 'ring-1 ring-[var(--color-sos)]/40'
      } ${isOwned ? 'bg-[var(--color-owned-soft)]' : isSeen ? 'bg-[var(--color-seen-soft)]' : 'bg-[var(--color-surface)]'}`}
      onClick={onClick}
    >
      {isRare && (
        <div className="absolute -top-1 -right-1 px-1 py-0.5 rounded-full bg-[var(--color-sos-rare)] text-white text-[8px] font-black leading-none">
          RARE
        </div>
      )}
      <div className="w-14 h-14 flex items-center justify-center">
        <img
          src={getSpriteUrl(enc.pokemon.key)}
          alt={enc.pokemon.displayName}
          className="w-full h-full object-contain"
          style={{ imageRendering: 'pixelated', filter: spriteFilter }}
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
        />
      </div>
      <div className={`text-[10px] font-bold text-center leading-tight mt-0.5 truncate w-full px-0.5 ${
        status === 'unseen' ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'
      }`}>
        {enc.pokemon.displayName}
      </div>
      <div className="text-[9px] text-[var(--color-text-muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{enc.rate}%</div>
      <div className={`text-[8px] font-semibold mt-0.5 ${isRare ? 'text-[var(--color-sos-rare)]' : 'text-[var(--color-sos)]'}`}>
        {slotLabel(enc.slots)}
      </div>
      <button
        className={`mt-1 w-full rounded-lg py-0.5 text-[9px] font-bold transition-opacity hover:opacity-80 ${
          isOwned
            ? 'bg-[var(--color-owned-soft)] text-[var(--color-owned)]'
            : isSeen
            ? 'bg-[var(--color-owned-soft)] text-[var(--color-owned)]'
            : 'bg-[var(--color-seen-soft)] text-[var(--color-seen)]'
        }`}
        onClick={(e) => { e.stopPropagation(); onAdvance(); }}
      >
        {isOwned ? '✓ Owned' : isSeen ? 'Mark Owned' : '👁 Mark Seen'}
      </button>
    </div>
  );
}

function ZoneCard({ label, table, tableIdx, timeOfDay, sosMode, getStatus, advanceStatus, onPokemonClick }: {
  label: string;
  table: Area['tables'][number];
  tableIdx: number;
  timeOfDay: 'day' | 'night';
  sosMode: boolean;
  getStatus: (key: string) => TrackStatus;
  advanceStatus: (key: string) => void;
  onPokemonClick: (enc: Encounter | SOSEncounter, tableIdx: number) => void;
}) {
  const normalEncounters = timeOfDay === 'day' ? table.day : table.night;
  const sosEncounters = timeOfDay === 'day' ? table.sosDayConsolidated : table.sosNightConsolidated;
  const hasSOS = sosEncounters.length > 0;

  if (!sosMode && normalEncounters.length === 0) return null;
  if (sosMode && sosEncounters.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden" style={{ background: 'var(--color-panel)' }}>
      {/* Card header */}
      <div className={`flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-border)] ${
        sosMode ? 'bg-[var(--color-sos)]/8' : ''
      }`}>
        <span className="text-xs font-black text-[var(--color-text)]">{label}</span>
        <span
          className="text-[10px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded-lg"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Lv.&nbsp;{table.minLevel}–{table.maxLevel}
        </span>
        {sosMode && (
          <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-lg bg-[var(--color-sos)] text-white tracking-wide">
            SOS
          </span>
        )}
        {!sosMode && hasSOS && (
          <span className="ml-auto text-[10px] font-semibold text-[var(--color-sos)] opacity-70">
            SOS available
          </span>
        )}
      </div>

      {/* Encounter grid */}
      <div className="p-2">
        {sosMode ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2">
            {sosEncounters.map(enc => (
              <SOSTile
                key={enc.pokemon.key}
                enc={enc}
                status={getStatus(enc.pokemon.key)}
                onAdvance={() => advanceStatus(enc.pokemon.key)}
                onClick={() => onPokemonClick(enc, tableIdx)}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2">
            {normalEncounters.map(enc => (
              <PokeTile
                key={enc.pokemon.key}
                encounter={enc}
                status={getStatus(enc.pokemon.key)}
                onAdvance={() => advanceStatus(enc.pokemon.key)}
                onClick={() => onPokemonClick(enc, tableIdx)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EncounterZoneCards({ area, timeOfDay, sosMode, getStatus, advanceStatus, onPokemonClick }: Props) {
  const labeled = area.tables.map((table, i) => ({
    table,
    idx: i,
    label: habitatLabel(i, area.tables.length, area.primaryName),
  }));

  const namedZones = labeled.filter(z => isNamedZone(z.label));
  const unknownZones = labeled.filter(z => !isNamedZone(z.label));

  // Start expanded when all zones are unknown (nothing is named)
  const [othersOpen, setOthersOpen] = useState(namedZones.length === 0);

  const sharedCardProps = { timeOfDay, sosMode, getStatus, advanceStatus, onPokemonClick };

  return (
    <div className="flex flex-col gap-3">
      {/* Named / recognised zones — always expanded */}
      {namedZones.map(({ table, idx, label }) => (
        <ZoneCard key={table.id} label={label} table={table} tableIdx={idx} {...sharedCardProps} />
      ))}

      {/* Unknown zones — collapsed under accordion */}
      {unknownZones.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] hover:bg-[var(--color-panel-hover)] transition-colors text-left"
            onClick={() => setOthersOpen(o => !o)}
          >
            <span className="text-xs font-black text-[var(--color-text-muted)]">Other encounter areas</span>
            <span
              className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded-lg"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {unknownZones.length}
            </span>
            <svg
              className={`w-3.5 h-3.5 ml-auto text-[var(--color-text-muted)] transition-transform duration-150 ${othersOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            >
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>

          {othersOpen && unknownZones.map(({ table, idx, label }) => {
            const letter = label.replace('Zone ', '');
            return (
              <ZoneCard
                key={table.id}
                label={`Other Encounter Area ${letter}`}
                table={table}
                tableIdx={idx}
                {...sharedCardProps}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
