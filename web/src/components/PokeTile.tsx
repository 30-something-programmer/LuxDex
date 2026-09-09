import type { PokemonCardModel, PokemonStatus } from "../types/presentation"
import { formatSlots } from "../lib/format"
import PokemonArtwork, { PokeBallIcon, SeenIcon } from "./PokemonArtwork"

interface PokeTileProps {
  pokemon: PokemonCardModel
  onSelect?: (pokemon: PokemonCardModel) => void
  onStatusAction?: (pokemonId: string, status: PokemonStatus) => void
  compact?: boolean
}
export default function PokeTile({
  pokemon,
  onSelect,
  onStatusAction,
  compact = false,
}: PokeTileProps) {
  const isOwned = pokemon.status === "owned"
  const isSeen = pokemon.status === "seen"
  const isUnseen = pokemon.status === "unseen"
  const nextStatus: PokemonStatus = isUnseen ? "seen" : "owned"
  const slotLabel = formatSlots(pokemon.sosSlots)

  const tileRing = isOwned
    ? "ring-2 ring-[var(--color-owned)]"
    : isSeen
      ? "ring-1 ring-[var(--color-seen)]"
      : pokemon.isRare
        ? "ring-2 ring-[var(--color-sos-rare)]"
        : "ring-1 ring-[var(--color-border)]"
  const tileBackground = isOwned
    ? "bg-[var(--color-owned-soft)]"
    : isSeen
      ? "bg-[var(--color-seen-soft)]"
      : "bg-[var(--color-surface)]"

  return (
    <div
      className={`relative flex select-none flex-col items-center rounded-xl p-1.5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg ${tileRing} ${tileBackground} ${
        onSelect ? "cursor-pointer" : ""
      }`}
      onClick={() => onSelect?.(pokemon)}
    >
      {pokemon.isRare && (
        <span className="absolute -right-1 -top-1 z-10 rounded-full bg-[var(--color-sos-rare)] px-1 py-0.5 text-[8px] font-black leading-none text-white">
          RARE
        </span>
      )}
      {isOwned && (
        <PokeBallIcon className="absolute right-1 top-1 z-10 h-4 w-4" />
      )}
      {isSeen && (
        <span className="absolute right-1 top-1 z-10 grid h-4 w-4 place-items-center rounded-full bg-[var(--color-seen)]">
          <SeenIcon className="h-2.5 w-2.5 text-white" />
        </span>
      )}

      <div
        className={
          compact
            ? "flex h-11 w-11 items-center justify-center"
            : "flex h-14 w-14 items-center justify-center"
        }
      >
        <PokemonArtwork
          name={pokemon.name}
          spriteAssetKey={pokemon.spriteAssetKey}
          status={pokemon.status}
        />
      </div>

      <div className="mt-0.5 w-full px-0.5 text-center">
        <div
          className={`truncate text-[10px] font-bold leading-tight ${
            isUnseen
              ? "text-[var(--color-text-muted)]"
              : "text-[var(--color-text)]"
          }`}
        >
          {pokemon.name}
        </div>
      </div>

      {pokemon.rate != null && (
        <div className="mt-0.5 rounded-full bg-[var(--color-panel)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--color-text-muted)] [font-family:var(--font-mono)]">
          {pokemon.rate}%
        </div>
      )}

      {slotLabel && (
        <div
          className={`mt-0.5 text-[8px] font-semibold ${
            pokemon.isRare
              ? "text-[var(--color-sos-rare)]"
              : "text-[var(--color-sos)]"
          }`}
        >
          SOS {slotLabel}
        </div>
      )}

      {onStatusAction && (
        <button
          className={`mt-1 w-full rounded-lg py-0.5 text-[9px] font-bold transition-opacity hover:opacity-80 ${
            isOwned
              ? "bg-[var(--color-owned-soft)] text-[var(--color-owned)]"
              : isSeen
                ? "bg-[var(--color-owned-soft)] text-[var(--color-owned)]"
                : "bg-[var(--color-seen-soft)] text-[var(--color-seen)]"
          }`}
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onStatusAction(pokemon.id, nextStatus)
          }}
          disabled={isOwned}
        >
          {isOwned ? "✓ Owned" : isSeen ? "Mark Owned" : "Mark Seen"}
        </button>
      )}
    </div>
  )
}
