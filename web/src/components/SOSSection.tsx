import { useState } from 'react';
import type { SOSEncounter, TrackStatus } from '../data/types';
import { getSpriteUrl } from '../data/sprites';

interface Props {
  encounters: SOSEncounter[];
  getStatus: (key: string) => TrackStatus;
  onAdvance: (key: string) => void;
  onOpenPanel: (enc: SOSEncounter) => void;
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
  return `SOS ${ranges.join(', ')}`;
}

export default function SOSSection({ encounters, getStatus, onAdvance, onOpenPanel }: Props) {
  const [open, setOpen] = useState(false);
  if (encounters.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-sos)]/10 text-[var(--color-sos)] font-bold text-sm w-full hover:opacity-80 transition-opacity"
        onClick={() => setOpen(o => !o)}
      >
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        <span>SOS Encounters ({encounters.length})</span>
        <svg className={`w-4 h-4 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {open && (
        <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2">
          {encounters.map(enc => {
            const status = getStatus(enc.pokemon.key);
            const isRare = enc.rate <= 1;
            const isOwned = status === 'caught';
            const isSeen = status === 'seen';
            const spriteUrl = getSpriteUrl(enc.pokemon.key);
            const spriteFilter = status === 'unseen' ? 'brightness(0) opacity(0.5)' : status === 'seen' ? 'saturate(0) opacity(0.5)' : 'none';

            return (
              <div
                key={enc.pokemon.key}
                className={`relative flex flex-col items-center rounded-xl p-1.5 cursor-pointer select-none bg-[var(--color-surface)] shadow-sm hover:shadow-md transition-all ${
                  isRare ? 'ring-2 ring-[var(--color-sos-rare)]' : 'ring-1 ring-[var(--color-sos)]/30'
                } ${isOwned ? 'bg-[var(--color-owned-soft)]' : isSeen ? 'bg-[var(--color-seen-soft)]' : ''}`}
                onClick={() => onOpenPanel(enc)}
              >
                {isRare && (
                  <div className="absolute -top-1 -right-1 px-1 py-0.5 rounded-full bg-[var(--color-sos-rare)] text-white text-[8px] font-black">
                    RARE
                  </div>
                )}
                <div className="w-12 h-12 flex items-center justify-center">
                  <img
                    src={spriteUrl}
                    alt={enc.pokemon.displayName}
                    className="w-full h-full object-contain"
                    style={{ imageRendering: 'pixelated', filter: spriteFilter }}
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                  />
                </div>
                <div className="text-[10px] font-bold text-center text-[var(--color-text)] leading-tight mt-0.5 truncate w-full px-0.5">
                  {enc.pokemon.displayName}
                </div>
                <div className="text-[9px] text-[var(--color-text-muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{enc.rate}%</div>
                <div className={`text-[8px] font-bold mt-0.5 ${isRare ? 'text-[var(--color-sos-rare)]' : 'text-[var(--color-sos)]'}`}>
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
                  onClick={(e) => { e.stopPropagation(); onAdvance(enc.pokemon.key); }}
                >
                  {isOwned ? '✓ Owned' : isSeen ? 'Mark Owned' : 'Mark Seen'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
