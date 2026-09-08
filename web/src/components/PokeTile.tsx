import type { Encounter } from '../data/types';
import type { TrackStatus } from '../data/types';
import { getSpriteUrl } from '../data/sprites';

interface Props {
  encounter: Encounter;
  status: TrackStatus;
  onAdvance: () => void;
  onClick: () => void;
}

// Small inline Poké Ball SVG for the Owned badge
function PokeBall({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill="#FBBF24" stroke="white" strokeWidth="1.5"/>
      <path d="M1.5 10h17M10 1.5a8.5 8.5 0 0 1 0 17" stroke="white" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="3" fill="white" stroke="white" strokeWidth="1"/>
      <circle cx="10" cy="10" r="1.5" fill="#FBBF24"/>
    </svg>
  );
}

export default function PokeTile({ encounter, status, onAdvance, onClick }: Props) {
  const spriteUrl = getSpriteUrl(encounter.pokemon.key);
  const isOwned = status === 'caught';
  const isSeen = status === 'seen';
  const isUnseen = status === 'unseen';

  // Sprite visual treatment per status
  const spriteFilter = isUnseen
    ? 'brightness(0) opacity(0.55)'
    : isSeen
    ? 'saturate(0) opacity(0.5)'
    : 'none';

  // Tile ring/border per status
  const tileRing = isOwned
    ? 'ring-2 ring-[var(--color-owned)]'
    : isSeen
    ? 'ring-1 ring-[var(--color-seen)]'
    : 'ring-1 ring-[var(--color-border)]';

  const tileBg = isOwned
    ? 'bg-[var(--color-owned-soft)]'
    : isSeen
    ? 'bg-[var(--color-seen-soft)]'
    : 'bg-[var(--color-surface)]';

  const actionLabel = isOwned ? null : isSeen ? 'Own' : 'Seen';
  const actionColor = isSeen
    ? 'bg-[var(--color-owned-soft)] text-[var(--color-owned)] hover:opacity-80'
    : 'bg-[var(--color-seen-soft)] text-[var(--color-seen)] hover:opacity-80';

  return (
    <div
      className={`relative flex flex-col items-center rounded-xl p-1.5 cursor-pointer select-none transition-all duration-150 shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 ${tileRing} ${tileBg}`}
      onClick={onClick}
    >
      {/* Owned badge — Poké Ball */}
      {isOwned && (
        <div className="absolute top-1 right-1 z-10">
          <PokeBall className="w-4 h-4" />
        </div>
      )}
      {/* Seen badge — eye */}
      {isSeen && (
        <div className="absolute top-1 right-1 z-10 w-4 h-4 rounded-full bg-[var(--color-seen)] flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
          </svg>
        </div>
      )}

      {/* Sprite */}
      <div className="w-14 h-14 flex items-center justify-center">
        <img
          src={spriteUrl}
          alt={encounter.pokemon.displayName}
          className="w-full h-full object-contain transition-all duration-200"
          style={{ imageRendering: 'pixelated', filter: spriteFilter }}
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
        />
      </div>

      {/* Name — hidden while unseen */}
      <div className="w-full text-center mt-0.5 px-0.5">
        <div className={`text-[10px] font-bold leading-tight truncate ${isUnseen ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>
          {encounter.pokemon.displayName}
        </div>
      </div>

      {/* Rate */}
      <div className="mt-0.5 px-1.5 py-0.5 rounded-full bg-[var(--color-panel)] text-[9px] font-semibold text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
        {encounter.rate}%
      </div>

      {/* Quick action */}
      {actionLabel && (
        <button
          className={`mt-1 w-full rounded-lg py-0.5 text-[9px] font-bold transition-opacity ${actionColor}`}
          onClick={(e) => { e.stopPropagation(); onAdvance(); }}
        >
          {actionLabel === 'Own' ? '✓ Mark Owned' : '👁 Mark Seen'}
        </button>
      )}
      {isOwned && (
        <div className="mt-1 w-full rounded-lg py-0.5 text-[9px] font-bold text-center text-[var(--color-owned)] bg-[var(--color-owned-soft)]">
          ✓ Owned
        </div>
      )}
    </div>
  );
}
