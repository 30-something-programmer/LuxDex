import { useState } from 'react';
import type { Area } from '../data/types';

interface Props {
  areas: Area[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose?: () => void;
}

export default function AreaNav({ areas, selectedId, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? areas.filter(a =>
        a.allNames.some(n => n.toLowerCase().includes(query.toLowerCase())) ||
        a.primaryName.toLowerCase().includes(query.toLowerCase())
      )
    : areas;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-2 border-b border-[var(--color-border)]">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-text)] placeholder-[var(--color-text-muted)] outline-none focus:ring-1 focus:ring-[var(--color-accent)]/40 border border-[var(--color-border)]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0">
        {filtered.map(area => {
          const isSelected = area.id === selectedId;
          const hasEncounters = area.tables.length > 0;
          return (
            <button
              key={area.id}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-[var(--color-accent)] text-white'
                  : hasEncounters
                  ? 'text-[var(--color-text)] hover:bg-[var(--color-panel)]'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-panel)]/50'
              }`}
              onClick={() => { onSelect(area.id); onClose?.(); }}
            >
              <div className="truncate">{area.primaryName}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
