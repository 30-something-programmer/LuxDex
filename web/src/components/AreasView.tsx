import { useMemo, useState } from 'react';
import type { Area, Encounter, EncounterTable, SOSEncounter, TrackStatus } from '../data/types';
import type { IslandId } from '../data/islands';
import { ISLANDS, getIslandForArea, habitatLabel } from '../data/islands';
import AreaNav from './AreaNav';
import IslandMap from './IslandMap';
import PokePanel from './PokePanel';
import EncounterZoneCards from './EncounterZoneCards';

interface Props {
  areas: Area[];
  selectedAreaId: string;
  onSelectArea: (id: string) => void;
  getStatus: (key: string) => TrackStatus;
  advanceStatus: (key: string) => void;
  setStatus: (key: string, status: TrackStatus) => void;
  onFindElsewhere: (name: string) => void;
}

function CompletionRow({ encounters, getStatus }: { encounters: Encounter[]; getStatus: (k: string) => TrackStatus }) {
  const unique = [...new Set(encounters.map(e => e.pokemon.key))];
  const caught = unique.filter(k => getStatus(k) === 'caught').length;
  const seen = unique.filter(k => getStatus(k) === 'seen').length;
  const total = unique.length;
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-0.5 flex-wrap">
        {unique.slice(0, 14).map(k => {
          const s = getStatus(k);
          return (
            <div key={k} className={`w-2.5 h-2.5 rounded-full transition-colors ${
              s === 'caught' ? 'bg-[var(--color-owned)]' :
              s === 'seen' ? 'bg-[var(--color-seen)]' :
              'bg-[var(--color-border)]'
            }`}/>
          );
        })}
        {unique.length > 14 && <span className="text-[9px] text-[var(--color-text-muted)] font-mono ml-0.5">+{unique.length - 14}</span>}
      </div>
      <span className="text-xs font-bold text-[var(--color-text-muted)]">
        <span className="text-[var(--color-owned)]">{caught}</span>
        {seen > 0 && <span className="text-[var(--color-seen)]"> · {seen} seen</span>}
        <span> / {total}</span>
      </span>
    </div>
  );
}

export default function AreasView({ areas, selectedAreaId, onSelectArea, getStatus, advanceStatus, setStatus, onFindElsewhere }: Props) {
  const selectedArea = areas.find(a => a.id === selectedAreaId);
  const currentIsland: IslandId = selectedArea ? getIslandForArea(selectedArea.primaryName) : 'melemele';

  const [activeIsland, setActiveIsland] = useState<IslandId>(currentIsland);
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'night'>('day');
  const [tableIdx, setTableIdx] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [panelEnc, setPanelEnc] = useState<Encounter | SOSEncounter | null>(null);
  const [sosMode, setSosMode] = useState(false);

  // Reset table index when area changes
  const handleSelectArea = (id: string) => {
    onSelectArea(id);
    setTableIdx(0);
  };

  // Areas belonging to the active island (for map and list)
  const islandAreas = useMemo(
    () => areas.filter(a => getIslandForArea(a.primaryName) === activeIsland),
    [areas, activeIsland]
  );

  // Completion aggregated per area for map rings
  const getAreaCompletion = (areaId: string) => {
    const area = areas.find(a => a.id === areaId);
    if (!area) return { caught: 0, total: 0 };
    const allEncs = area.tables.flatMap(t => [...t.day, ...t.night]);
    const unique = [...new Set(allEncs.map(e => e.pokemon.key))];
    return {
      caught: unique.filter(k => getStatus(k) === 'caught').length,
      total: unique.length,
    };
  };

  const prevArea = () => {
    const idx = areas.findIndex(a => a.id === selectedAreaId);
    if (idx > 0) handleSelectArea(areas[idx - 1].id);
  };
  const nextArea = () => {
    const idx = areas.findIndex(a => a.id === selectedAreaId);
    if (idx < areas.length - 1) handleSelectArea(areas[idx + 1].id);
  };

  const table: EncounterTable | undefined = selectedArea?.tables[tableIdx];

  const islandInfo = ISLANDS.find(i => i.id === activeIsland)!;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Island tabs — top bar */}
      <div className="flex-shrink-0 flex gap-1 px-3 pt-3 pb-0 overflow-x-auto bg-[var(--color-surface)] border-b border-[var(--color-border)]" style={{ scrollbarWidth: 'none' }}>
        {ISLANDS.filter(i => i.id !== 'other').map(island => {
          const isActive = activeIsland === island.id;
          return (
            <button
              key={island.id}
              className={`flex-shrink-0 px-4 py-2 rounded-t-xl text-sm font-black transition-all border-b-2 ${
                isActive
                  ? 'bg-[var(--color-panel)] border-current'
                  : 'bg-transparent border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
              style={isActive ? { color: island.color, borderColor: island.color } : {}}
              onClick={() => setActiveIsland(island.id)}
            >
              {island.name}
            </button>
          );
        })}
        {/* Other tab */}
        <button
          className={`flex-shrink-0 px-4 py-2 rounded-t-xl text-sm font-black transition-all border-b-2 ${
            activeIsland === 'other'
              ? 'bg-[var(--color-panel)] border-[var(--color-text-muted)] text-[var(--color-text)]'
              : 'bg-transparent border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
          onClick={() => setActiveIsland('other')}
        >
          Other
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0 overflow-hidden">
          {/* Island map */}
          <div className="flex-shrink-0 p-3 border-b border-[var(--color-border)]">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: islandInfo.color }}>
              {islandInfo.fullName}
            </div>
            <IslandMap
              island={activeIsland}
              areas={islandAreas}
              selectedAreaId={selectedAreaId}
              onSelectArea={handleSelectArea}
              getAreaCompletion={getAreaCompletion}
            />
          </div>
          {/* Fallback list for areas not on map */}
          <div className="flex-1 overflow-hidden">
            <AreaNav
              areas={islandAreas}
              selectedId={selectedAreaId}
              onSelect={handleSelectArea}
            />
          </div>
        </aside>

        {/* Mobile map overlay */}
        {navOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden" onClick={() => setNavOpen(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/>
            <div
              className="relative z-10 w-80 bg-[var(--color-surface)] h-full flex flex-col shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <div className="font-black text-base" style={{ color: islandInfo.color }}>{islandInfo.fullName}</div>
                <button className="w-8 h-8 rounded-full bg-[var(--color-panel)] flex items-center justify-center" onClick={() => setNavOpen(false)}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="flex-shrink-0 p-3 border-b border-[var(--color-border)]">
                <IslandMap
                  island={activeIsland}
                  areas={islandAreas}
                  selectedAreaId={selectedAreaId}
                  onSelectArea={(id) => { handleSelectArea(id); setNavOpen(false); }}
                  getAreaCompletion={getAreaCompletion}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <AreaNav
                  areas={islandAreas}
                  selectedId={selectedAreaId}
                  onSelect={(id) => { handleSelectArea(id); setNavOpen(false); }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Main encounter area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Route header */}
          <div className="flex-shrink-0 px-4 pt-3 pb-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="flex items-center gap-2 mb-2">
              {/* Mobile map button */}
              <button
                className="lg:hidden w-9 h-9 rounded-xl bg-[var(--color-panel)] flex items-center justify-center flex-shrink-0"
                onClick={() => setNavOpen(true)}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
              </button>

              <button className="w-7 h-7 rounded-lg bg-[var(--color-panel)] flex items-center justify-center hover:bg-[var(--color-panel-hover)] transition-colors" onClick={prevArea}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
              </button>

              <div className="flex-1 min-w-0">
                {/* Breadcrumb */}
                <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-text-muted)] mb-0.5">
                  <span style={{ color: islandInfo.color }}>{islandInfo.name}</span>
                  <span>›</span>
                  {selectedArea && table && <span>{habitatLabel(tableIdx, selectedArea.tables.length, selectedArea.primaryName)}</span>}
                </div>
                <div className="font-black text-lg text-[var(--color-text)] truncate leading-tight">
                  {selectedArea?.primaryName ?? 'Select an area'}
                </div>
              </div>

              <button className="w-7 h-7 rounded-lg bg-[var(--color-panel)] flex items-center justify-center hover:bg-[var(--color-panel-hover)] transition-colors" onClick={nextArea}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>

            {selectedArea && selectedArea.tables.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Day/Night */}
                <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-panel)]">
                  <button
                    className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1 transition-colors ${timeOfDay === 'day' ? 'bg-[var(--color-owned)] text-[var(--color-bg)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                    onClick={() => setTimeOfDay('day')}
                  >
                    ☀ Day
                  </button>
                  <button
                    className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1 transition-colors ${timeOfDay === 'night' ? 'bg-[var(--color-ulaula)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                    onClick={() => setTimeOfDay('night')}
                  >
                    ☽ Night
                  </button>
                </div>

                {/* SOS toggle */}
                <button
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    sosMode
                      ? 'bg-[var(--color-sos)] text-white border-[var(--color-sos)]'
                      : 'bg-[var(--color-panel)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]'
                  }`}
                  onClick={() => setSosMode(s => !s)}
                >
                  SOS
                </button>

                {/* Level range */}
                {table && (
                  <div className="ml-auto text-xs font-mono font-semibold text-[var(--color-text-muted)] bg-[var(--color-panel)] px-2.5 py-1.5 rounded-xl">
                    Lv. {table.minLevel}–{table.maxLevel}
                  </div>
                )}
              </div>
            )}

            {/* Completion */}
            {selectedArea && selectedArea.tables.length > 0 && (
              <div className="mt-2">
                <CompletionRow
                  encounters={selectedArea.tables.flatMap(t => timeOfDay === 'day' ? t.day : t.night)}
                  getStatus={getStatus}
                />
              </div>
            )}
          </div>

          {/* Main scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {!selectedArea && (
              <div className="flex flex-col items-center justify-center h-full text-center text-[var(--color-text-muted)] p-4">
                <div className="text-4xl mb-3">🗺</div>
                <div className="font-bold text-base">Select a location from the map</div>
                <div className="text-sm mt-1 opacity-70">Choose an island above, then tap a route</div>
              </div>
            )}

            {selectedArea && selectedArea.tables.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center text-[var(--color-text-muted)]">
                <div className="font-semibold text-sm">No wild encounters here</div>
              </div>
            )}

            {selectedArea && selectedArea.tables.length > 0 && (
              <div className="px-3 pt-3 pb-4">
                <EncounterZoneCards
                  area={selectedArea}
                  timeOfDay={timeOfDay}
                  sosMode={sosMode}
                  getStatus={getStatus}
                  advanceStatus={advanceStatus}
                  onPokemonClick={(enc, idx) => { setTableIdx(idx); setPanelEnc(enc); }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PokePanel */}
      {panelEnc && (
        <PokePanel
          encounter={panelEnc}
          status={getStatus(panelEnc.pokemon.key)}
          onSetStatus={(s) => setStatus(panelEnc.pokemon.key, s)}
          onClose={() => setPanelEnc(null)}
          onFindElsewhere={() => { setPanelEnc(null); onFindElsewhere(panelEnc.pokemon.displayName); }}
          locationContext={table ? {
            areaName: selectedArea?.primaryName ?? '',
            tableLabel: habitatLabel(tableIdx, selectedArea?.tables.length ?? 1, selectedArea?.primaryName ?? ''),
            isSOS: 'slots' in panelEnc,
            timeOfDay,
            levelMin: table.minLevel,
            levelMax: table.maxLevel,
          } : undefined}
        />
      )}
    </div>
  );
}
