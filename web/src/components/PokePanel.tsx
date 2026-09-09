import type {
  EncounterOccurrenceModel,
  PokemonCardModel,
  PokedexEntryModel,
  PokemonStatus,
} from "../types/presentation"
import { formatLevelRange } from "../lib/format"
import PokemonArtwork, { PokeBallIcon } from "./PokemonArtwork"

interface PokePanelProps {
  pokemon: PokedexEntryModel | null
  occurrence?: EncounterOccurrenceModel
  onSetStatus?: (pokemonId: string, status: PokemonStatus) => void
  onClose: () => void
  onFindElsewhere?: (pokemon: PokemonCardModel) => void
}
export default function PokePanel({
  pokemon,
  occurrence,
  onSetStatus,
  onClose,
  onFindElsewhere,
}: PokePanelProps) {
  if (!pokemon) return null

  const isOwned = pokemon.status === "owned"
  const isSeen = pokemon.status === "seen"
  const statusColor = isOwned
    ? "text-[var(--color-owned)]"
    : isSeen
      ? "text-[var(--color-seen)]"
      : "text-[var(--color-text-muted)]"

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl sm:mx-4 sm:max-w-sm sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-[var(--color-panel)] hover:bg-[var(--color-panel-hover)]"
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

        <div className="mb-4 flex items-center gap-4">
          <div className="relative grid h-20 w-20 flex-shrink-0 place-items-center rounded-2xl bg-[var(--color-panel)]">
            <PokemonArtwork
              name={pokemon.name}
              spriteAssetKey={pokemon.spriteAssetKey}
              status={pokemon.status}
              className="h-16 w-16"
            />
            {isOwned && (
              <PokeBallIcon className="absolute -bottom-1 -right-1 h-6 w-6" />
            )}
          </div>
          <div>
            <div className="text-xl font-black text-[var(--color-text)]">
              {pokemon.name}
            </div>
            <div className={`text-sm font-bold ${statusColor}`}>
              {isOwned ? "Owned" : isSeen ? "Seen" : "Unseen"}
            </div>
          </div>
        </div>

        {(pokemon.alolaDexNumber != null ||
          pokemon.nationalDexNumber != null ||
          pokemon.generation != null) && (
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-[var(--color-panel)] p-3">
            <div>
              <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Alola Dex
              </div>
              <div className="text-base font-black text-[var(--color-text)] [font-family:var(--font-mono)]">
                {pokemon.alolaDexNumber == null
                  ? "—"
                  : `#${String(pokemon.alolaDexNumber).padStart(3, "0")}`}
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                National Dex
              </div>
              <div className="text-base font-black text-[var(--color-text)] [font-family:var(--font-mono)]">
                {pokemon.nationalDexNumber == null
                  ? "—"
                  : `#${String(pokemon.nationalDexNumber).padStart(3, "0")}`}
              </div>
            </div>
            {pokemon.generation != null && (
              <div className="col-span-2">
                <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Generation
                </div>
                <div className="text-sm font-semibold text-[var(--color-text)]">
                  Gen {pokemon.generation}
                </div>
              </div>
            )}
          </div>
        )}

        {occurrence && (
          <div className="mb-4 space-y-1.5 rounded-xl bg-[var(--color-panel)] p-3 text-sm">
            <div className="text-xs font-bold text-[var(--color-text)]">
              {occurrence.locationName} · {occurrence.zoneLabel}
            </div>
            <div className="flex gap-3 text-xs text-[var(--color-text-muted)] [font-family:var(--font-mono)]">
              <span>
                {formatLevelRange(occurrence.minLevel, occurrence.maxLevel)}
              </span>
              <span>{occurrence.rate}%</span>
              {occurrence.isSos && (
                <span className="font-bold text-[var(--color-sos)]">SOS</span>
              )}
              <span>
                {occurrence.timeOfDay === "both"
                  ? "Day & Night"
                  : occurrence.timeOfDay === "day"
                    ? "☀ Day"
                    : "☽ Night"}
              </span>
            </div>
          </div>
        )}

        {onSetStatus && (
          <div className="mb-2 grid grid-cols-2 gap-2">
            <button
              className={`rounded-xl py-2.5 text-sm font-bold ${
                isSeen || isOwned
                  ? "bg-[var(--color-seen)] text-white"
                  : "bg-[var(--color-seen-soft)] text-[var(--color-seen)]"
              }`}
              type="button"
              onClick={() => onSetStatus(pokemon.id, "seen")}
              disabled={isOwned}
            >
              {isSeen || isOwned ? "Seen ✓" : "Mark Seen"}
            </button>
            <button
              className={`rounded-xl py-2.5 text-sm font-bold ${
                isOwned
                  ? "bg-[var(--color-owned)] text-[var(--color-bg)]"
                  : "bg-[var(--color-owned-soft)] text-[var(--color-owned)]"
              }`}
              type="button"
              onClick={() => onSetStatus(pokemon.id, "owned")}
            >
              {isOwned ? "✓ Owned" : "Mark Owned"}
            </button>
          </div>
        )}

        <div className="flex gap-2">
          {onSetStatus && pokemon.status !== "unseen" && (
            <button
              className="flex-1 rounded-xl bg-[var(--color-panel)] py-2 text-xs font-semibold text-[var(--color-text-muted)]"
              type="button"
              onClick={() => onSetStatus(pokemon.id, "unseen")}
            >
              Reset
            </button>
          )}
          {onFindElsewhere && (
            <button
              className="flex-1 rounded-xl bg-[var(--color-accent-soft)] py-2 text-xs font-semibold text-[var(--color-accent)]"
              type="button"
              onClick={() => onFindElsewhere(pokemon)}
            >
              Find elsewhere →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
