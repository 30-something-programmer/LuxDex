import { useState } from "react"
import type { PokemonCardModel, PokemonStatus } from "../types/presentation"
import PokeTile from "./PokeTile"

interface SOSSectionProps {
  encounters: PokemonCardModel[]
  onPokemonSelect?: (pokemon: PokemonCardModel) => void
  onStatusAction?: (pokemonId: string, status: PokemonStatus) => void
}
export default function SOSSection({
  encounters,
  onPokemonSelect,
  onStatusAction,
}: SOSSectionProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-4">
      <button
        className="flex w-full items-center gap-2 rounded-xl bg-[var(--color-sos)]/10 px-3 py-2 text-sm font-bold text-[var(--color-sos)] transition-opacity hover:opacity-80"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <svg
          className="h-4 w-4 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <span>SOS Encounters ({encounters.length})</span>
        <svg
          className={`ml-auto h-4 w-4 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
          {encounters.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-[var(--color-border)] p-5 text-center text-xs font-semibold text-[var(--color-text-muted)]">
              No SOS encounters loaded
            </div>
          ) : (
            encounters.map((encounter) => (
              <PokeTile
                key={encounter.id}
                pokemon={encounter}
                onSelect={onPokemonSelect}
                onStatusAction={onStatusAction}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
