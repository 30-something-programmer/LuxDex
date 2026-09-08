import { useMemo, useState } from 'react';
import rawData from './assets/penumbra-data.txt?raw';
import { parseRawData } from './data/parser';
import { useTracker } from './hooks/useTracker';
import { FULL_POKEDEX } from './data/pokedex';
import AreasView from './components/AreasView';
import PokemonSearch from './components/PokemonSearch';
import PokedexView from './components/PokedexView';

type Tab = 'areas' | 'pokemon' | 'pokedex';
type Theme = 'dark' | 'light';

function SunIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

const TABS: { key: Tab; label: string; path: string }[] = [
  { key: 'areas',   label: 'Areas',   path: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { key: 'pokemon', label: 'Pokémon', path: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { key: 'pokedex', label: 'Pokédex', path: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
];

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    document.documentElement.removeAttribute('data-theme');
    return 'dark';
  });
  const areas = useMemo(() => parseRawData(rawData), []);
  const { getStatus, setStatus, advanceStatus } = useTracker();
  const [tab, setTab] = useState<Tab>('areas');
  const [selectedAreaId, setSelectedAreaId] = useState<string>(() => {
    const first = areas.find(a => a.tables.length > 0);
    return first?.id ?? areas[0]?.id ?? '';
  });
  const [searchQuery, setSearchQuery] = useState('');

  const handleFindElsewhere = (name: string) => {
    setSearchQuery(name);
    setTab('pokemon');
  };

  const handleGoToArea = (areaId: string) => {
    setSelectedAreaId(areaId);
    setTab('areas');
  };

  const toggleTheme = () => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      if (next === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)]">
      <div className="flex-1 overflow-hidden">
        {tab === 'areas' && (
          <AreasView
            areas={areas}
            selectedAreaId={selectedAreaId}
            onSelectArea={setSelectedAreaId}
            getStatus={getStatus}
            advanceStatus={advanceStatus}
            setStatus={setStatus}
            onFindElsewhere={handleFindElsewhere}
          />
        )}
        {tab === 'pokemon' && (
          <PokemonSearch
            areas={areas}
            pokedex={FULL_POKEDEX}
            getStatus={getStatus}
            setStatus={setStatus}
            advanceStatus={advanceStatus}
            initialQuery={searchQuery}
            onGoToArea={handleGoToArea}
          />
        )}
        {tab === 'pokedex' && (
          <PokedexView
            pokedex={FULL_POKEDEX}
            getStatus={getStatus}
            setStatus={setStatus}
            onFindInPenumbra={(name) => { setSearchQuery(name); setTab('pokemon'); }}
          />
        )}
      </div>

      {/* Bottom nav */}
      <nav className="flex-shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex items-stretch">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-2 transition-all duration-100 ${
              tab === t.key ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
            onClick={() => {
              if (t.key === 'pokemon') setSearchQuery('');
              setTab(t.key);
            }}
          >
            <svg
              className={`w-5 h-5 transition-transform duration-100 ${tab === t.key ? 'scale-110' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={tab === t.key ? '2.5' : '1.8'}
            >
              <path d={t.path} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className={`text-[10px] font-bold leading-none ${tab === t.key ? 'text-[var(--color-accent)]' : ''}`}>{t.label}</span>
            {tab === t.key && <div className="w-1 h-1 rounded-full bg-[var(--color-accent)]"/>}
          </button>
        ))}

        <button
          className="flex flex-col items-center gap-0.5 py-2.5 px-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors border-l border-[var(--color-border)]"
          onClick={toggleTheme}
          title="Toggle theme"
        >
          {theme === 'dark' ? <SunIcon/> : <MoonIcon/>}
          <span className="text-[9px] font-bold">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </nav>
    </div>
  );
}
