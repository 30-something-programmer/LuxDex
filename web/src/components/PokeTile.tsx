import type { PokemonCardModel, PokemonStatus } from "../types/presentation"
import { formatLevelRange, formatSlots } from "../lib/format"
import PokemonArtwork, { EyeClosedIcon, PokeBallIcon, SeenIcon } from "./PokemonArtwork"

interface PokeTileProps {
  pokemon: PokemonCardModel
  onSelect?: (pokemon: PokemonCardModel) => void
  onMarkSeen?: (canonicalKey: string, status: PokemonStatus) => void
  onMarkOwned?: (canonicalKey: string, status: PokemonStatus) => void
}
export default function PokeTile({
  pokemon,
  onSelect,
  onMarkSeen,
  onMarkOwned,
}: PokeTileProps) {
  const isOwned = pokemon.status === "owned"
  const isSeen = pokemon.status === "seen"
  const isUnseen = pokemon.status === "unseen"
  const slotLabel = formatSlots(pokemon.sosSlots)
  const levelLabel = formatLevelRange(
    pokemon.minLevel ?? undefined,
    pokemon.maxLevel ?? undefined,
  )
  const topCenterLabel = pokemon.contextLabel ?? (slotLabel ? `SOS ${slotLabel}` : null)

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

  const badgeClass =
    "absolute z-10 rounded-md bg-[var(--color-bg)]/70 px-1 py-0.5 text-[8px] font-black leading-none backdrop-blur-[1px]"
  const controlButtonClass =
    "grid h-5 w-5 place-items-center rounded-md bg-[var(--color-bg)]/70 backdrop-blur-[1px] transition-opacity hover:opacity-80 disabled:cursor-default disabled:hover:opacity-100"

  return (
    <div
      className={`group relative aspect-square select-none overflow-hidden rounded-xl shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg ${tileRing} ${tileBackground} ${
        onSelect ? "cursor-pointer" : ""
      }`}
      onClick={() => onSelect?.(pokemon)}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? `Open ${pokemon.name} details` : undefined}
      onKeyDown={(event) => {
        if (onSelect && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          onSelect(pokemon)
        }
      }}
    >
      <div className="absolute inset-1.5">
        <PokemonArtwork
          name={pokemon.name}
          spritePath={pokemon.spritePath}
          status={pokemon.status}
        />
      </div>

      {levelLabel && (
        <span
          className={`${badgeClass} left-1 top-1 text-[var(--color-text)] [font-family:var(--font-mono)]`}
        >
          {levelLabel}
        </span>
      )}

      {topCenterLabel && (
        <span
          className={`${badgeClass} left-1/2 top-1 -translate-x-1/2 whitespace-nowrap ${
            pokemon.isRare ? "text-[var(--color-sos-rare)]" : "text-[var(--color-sos)]"
          }`}
        >
          {topCenterLabel}
        </span>
      )}

      <span
        className={`${badgeClass} right-1 top-1 max-w-[60%] truncate ${
          isUnseen ? "text-[var(--color-text-muted)]" : "text-[var(--color-text)]"
        }`}
      >
        {pokemon.name}
      </span>

      {pokemon.rate != null && (
        <span
          className={`${badgeClass} bottom-1 left-1 text-[var(--color-text-muted)] [font-family:var(--font-mono)]`}
        >
          {pokemon.rate}%
        </span>
      )}

      <div className="absolute bottom-1 right-1 z-10 flex gap-0.5">
        <button
          type="button"
          className={controlButtonClass}
          disabled={!isUnseen || !onMarkSeen}
          aria-label={
            isUnseen ? `Mark ${pokemon.name} as seen` : `${pokemon.name} has been seen`
          }
          title={
            isUnseen ? `Mark ${pokemon.name} as seen` : `${pokemon.name} has been seen`
          }
          onClick={(event) => {
            event.stopPropagation()
            if (isUnseen) onMarkSeen?.(pokemon.canonicalKey, pokemon.status)
          }}
        >
          {isUnseen ? (
            <EyeClosedIcon className="h-3 w-3 text-[var(--color-text-muted)]" />
          ) : (
            <SeenIcon className="h-3 w-3 text-[var(--color-seen)]" />
          )}
        </button>
        <button
          type="button"
          className={controlButtonClass}
          disabled={isOwned || !onMarkOwned}
          aria-label={isOwned ? `${pokemon.name} is owned` : `Mark ${pokemon.name} as owned`}
          title={isOwned ? `${pokemon.name} is owned` : `Mark ${pokemon.name} as owned`}
          onClick={(event) => {
            event.stopPropagation()
            if (!isOwned) onMarkOwned?.(pokemon.canonicalKey, pokemon.status)
          }}
        >
          <PokeBallIcon className="h-3.5 w-3.5" muted={!isOwned} />
        </button>
      </div>
    </div>
  )
}
