import type { Encounter, SOSEncounter, TrackStatus } from '../data/types';
import { getSpriteUrl } from '../data/sprites';

interface Props {
  encounter: Encounter | SOSEncounter | null;
  status: TrackStatus;
  onSetStatus: (status: TrackStatus) => void;
  onClose: () => void;
  onFindElsewhere: () => void;
  locationContext?: {
    areaName: string;
    tableLabel: string;
    isSOS: boolean;
    timeOfDay: 'day' | 'night' | 'both';
    levelMin: number;
    levelMax: number;
  };
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

export default function PokePanel({ encounter, status, onSetStatus, onClose, onFindElsewhere, locationContext }: Props) {
  if (!encounter) return null;

  const spriteUrl = getSpriteUrl(encounter.pokemon.key);
  const isOwned = status === 'caught';
  const isSeen = status === 'seen';

  const spriteFilter = status === 'unseen'
    ? 'brightness(0) opacity(0.4)'
    : status === 'seen'
    ? 'saturate(0) opacity(0.5)'
    : 'none';

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
              alt={encounter.pokemon.displayName}
              className="w-16 h-16 object-contain"
              style={{ imageRendering: 'pixelated', filter: spriteFilter }}
            />
            {isOwned && <PokeBall className="absolute -bottom-1 -right-1 w-6 h-6"/>}
          </div>
          <div>
            <div className="font-black text-xl text-[var(--color-text)]">
              {encounter.pokemon.displayName}
            </div>
            <div className={`text-sm font-bold ${statusColor}`}>{statusLabel}</div>
          </div>
        </div>

        {/* Location context */}
        {locationContext && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--color-panel)] text-sm space-y-1.5">
            <div className="font-bold text-[var(--color-text)] text-xs">{locationContext.areaName} · {locationContext.tableLabel}</div>
            <div className="flex gap-3 font-mono text-xs text-[var(--color-text-muted)]">
              <span>Lv. {locationContext.levelMin}–{locationContext.levelMax}</span>
              <span>{encounter.rate}%</span>
              {locationContext.isSOS && <span className="text-[var(--color-sos)] font-bold">SOS</span>}
              <span className={locationContext.timeOfDay === 'day' ? 'text-[var(--color-owned)]' : 'text-[var(--color-ulaula)]'}>
                {locationContext.timeOfDay === 'both' ? 'Day & Night' : locationContext.timeOfDay === 'day' ? '☀ Day' : '☽ Night'}
              </span>
            </div>
          </div>
        )}

        {/* Action buttons */}
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
            className="flex-1 py-2 rounded-xl text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-accent-soft)] hover:opacity-80 transition-opacity"
            onClick={onFindElsewhere}
          >
            Find elsewhere →
          </button>
        </div>
      </div>
    </div>
  );
}
