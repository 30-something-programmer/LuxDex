import type {
  PokemonDetailModel,
  PokemonStatus,
  ResourceState,
} from "../types/presentation"
import { formatLevelRange, formatSlots } from "../lib/format"
import PokemonArtwork from "./PokemonArtwork"

interface PokePanelProps {
  open: boolean
  pokemon: PokemonDetailModel | null
  state: ResourceState
  onClose: () => void
  onSelectForm: (canonicalKey: string) => void
  onGoToLocation: (groupKey: string, locationKey: string) => void
  onSetStatus: (canonicalKey: string, status: PokemonStatus) => void
  mutationPending?: boolean
}

export default function PokePanel({
  open,
  pokemon,
  state,
  onClose,
  onSelectForm,
  onGoToLocation,
  onSetStatus,
  mutationPending = false,
}: PokePanelProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <section
        className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl sm:mx-4 sm:max-w-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
        aria-label="Pokémon details"
      >
        <button
          className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full bg-[var(--color-panel)] hover:bg-[var(--color-panel-hover)]"
          type="button"
          onClick={onClose}
          aria-label="Close Pokémon details"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {state === "loading" && !pokemon && (
          <div className="space-y-3" aria-label="Loading Pokémon details">
            <div className="h-24 animate-pulse rounded-2xl bg-[var(--color-panel)]" />
            <div className="h-40 animate-pulse rounded-2xl bg-[var(--color-panel)]" />
          </div>
        )}

        {state === "error" && !pokemon && (
          <div className="grid min-h-56 place-items-center text-center">
            <div>
              <h2 className="font-black text-[var(--color-text)]">
                Pokémon details are unavailable
              </h2>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text-muted)]">
                Unable to load canonical Pokémon data.
              </p>
            </div>
          </div>
        )}

        {pokemon && (
          <>
            <div className="mb-4 flex items-center gap-4 pr-10">
              <div className="grid h-24 w-24 flex-shrink-0 place-items-center rounded-2xl bg-[var(--color-panel)]">
                <PokemonArtwork
                  name={pokemon.name}
                  spritePath={pokemon.spritePath}
                  status={pokemon.status}
                  className="h-20 w-20"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-accent)]">
                  Canonical form
                </p>
                <h2 className="truncate text-xl font-black text-[var(--color-text)]">
                  {pokemon.name}
                </h2>
                {pokemon.speciesName !== pokemon.name && (
                  <p className="text-xs font-bold text-[var(--color-text-muted)]">
                    {pokemon.speciesName}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[9px] font-bold uppercase text-[var(--color-text-muted)]">
                    Current status
                  </div>
                  <div className="font-black capitalize text-[var(--color-text)]">
                    {pokemon.status}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pokemon.status === "unseen" && (
                    <button
                      className="rounded-lg bg-[var(--color-seen)] px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
                      type="button"
                      disabled={mutationPending}
                      onClick={() => onSetStatus(pokemon.canonicalKey, "seen")}
                    >
                      Mark Seen
                    </button>
                  )}
                  {pokemon.status !== "owned" && (
                    <button
                      className="rounded-lg bg-[var(--color-owned)] px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
                      type="button"
                      disabled={mutationPending}
                      onClick={() => onSetStatus(pokemon.canonicalKey, "owned")}
                    >
                      Mark Owned
                    </button>
                  )}
                  {pokemon.status === "owned" && (
                    <button
                      className="rounded-lg bg-[var(--color-surface)] px-3 py-1.5 text-xs font-black text-[var(--color-seen)] disabled:opacity-50"
                      type="button"
                      disabled={mutationPending}
                      onClick={() => onSetStatus(pokemon.canonicalKey, "seen")}
                    >
                      Set to Seen
                    </button>
                  )}
                  {pokemon.status !== "unseen" && (
                    <button
                      className="rounded-lg border border-[var(--color-danger)]/50 px-3 py-1.5 text-xs font-black text-[var(--color-danger)] disabled:opacity-50"
                      type="button"
                      disabled={mutationPending}
                      onClick={() => {
                        if (window.confirm(`Reset ${pokemon.name} to Unseen?`))
                          onSetStatus(pokemon.canonicalKey, "unseen")
                      }}
                    >
                      Reset to Unseen
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl bg-[var(--color-panel)] p-3">
              <div>
                <div className="text-[9px] font-bold uppercase text-[var(--color-text-muted)]">
                  National
                </div>
                <div className="font-black text-[var(--color-text)] [font-family:var(--font-mono)]">
                  #{String(pokemon.nationalDexNumber).padStart(3, "0")}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-[var(--color-text-muted)]">
                  USUM Alola
                </div>
                <div className="font-black text-[var(--color-text)] [font-family:var(--font-mono)]">
                  {pokemon.alolaDexNumber == null
                    ? "—"
                    : `#${String(pokemon.alolaDexNumber).padStart(3, "0")}`}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-[var(--color-text-muted)]">
                  Generation
                </div>
                <div className="font-black text-[var(--color-text)]">
                  Gen {pokemon.generation}
                </div>
              </div>
            </div>

            {pokemon.forms.length > 1 && (
              <div className="mb-4">
                <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                  Forms
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {pokemon.forms.map((form) => (
                    <button
                      key={form.key}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-black ${
                        form.key === pokemon.canonicalKey
                          ? "bg-[var(--color-accent)] text-white"
                          : "bg-[var(--color-panel)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      }`}
                      type="button"
                      onClick={() => onSelectForm(form.key)}
                      aria-pressed={form.key === pokemon.canonicalKey}
                    >
                      {form.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-black text-[var(--color-text)]">
                Find in Penumbra
              </h3>
              {pokemon.occurrences.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-center text-xs font-semibold text-[var(--color-text-muted)]">
                  No Penumbra wild encounter was found for this Pokémon.
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
                  {pokemon.occurrences.map((occurrence) => (
                    <button
                      key={occurrence.id}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-panel-hover)]"
                      type="button"
                      onClick={() =>
                        onGoToLocation(
                          occurrence.areaGroupKey,
                          occurrence.locationId,
                        )
                      }
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-black text-[var(--color-text)]">
                          {occurrence.locationName}
                        </span>
                        <span className="block truncate text-[10px] font-semibold text-[var(--color-text-muted)]">
                          {occurrence.zoneLabel} · {occurrence.areaGroupName}
                        </span>
                      </span>
                      <span className="hidden text-[9px] font-bold text-[var(--color-text-muted)] [font-family:var(--font-mono)] sm:block">
                        {formatLevelRange(
                          occurrence.minLevel,
                          occurrence.maxLevel,
                        ) ?? "Levels vary"}
                      </span>
                      {occurrence.sosSlots?.length ? (
                        <span className="rounded-lg bg-[var(--color-sos)]/15 px-2 py-1 text-[9px] font-black text-[var(--color-sos)]">
                          SOS {formatSlots(occurrence.sosSlots)}
                        </span>
                      ) : occurrence.isSos ? (
                        <span className="rounded-lg bg-[var(--color-sos)]/15 px-2 py-1 text-[9px] font-black text-[var(--color-sos)]">
                          Additional SOS
                        </span>
                      ) : null}
                      <span className="text-[9px] font-black text-[var(--color-text-muted)]">
                        {occurrence.timeOfDay === "day" ? "☀ Day" : "☽ Night"}
                      </span>
                      {occurrence.rate != null && (
                        <span className="w-9 text-right text-[10px] font-black text-[var(--color-accent)] [font-family:var(--font-mono)]">
                          {occurrence.rate}%
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
