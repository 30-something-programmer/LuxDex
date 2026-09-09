import { useEffect, useState } from "react"
import type { PokemonStatus } from "../types/presentation"
import { normalizeLocalSpritePath } from "../lib/sprites"

export function PokeBallIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="9"
        fill="var(--color-owned)"
        stroke="white"
        strokeWidth="1.5"
      />
      <path d="M1.5 10h17" stroke="white" strokeWidth="1.5" />
      <circle
        cx="10"
        cy="10"
        r="3"
        fill="white"
        stroke="white"
        strokeWidth="1"
      />
      <circle cx="10" cy="10" r="1.5" fill="var(--color-owned)" />
    </svg>
  )
}

export function SeenIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5Zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    </svg>
  )
}

interface PokemonArtworkProps {
  name: string
  spritePath?: string | null
  status: PokemonStatus
  className?: string
}

export default function PokemonArtwork({
  name,
  spritePath: suppliedSpritePath,
  status,
  className = "h-full w-full",
}: PokemonArtworkProps) {
  const spritePath = normalizeLocalSpritePath(suppliedSpritePath)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    if (!spritePath) console.warn(`[LuxDex] Missing local sprite for ${name}.`)
  }, [name, spritePath])
  const filter =
    status === "unseen"
      ? "brightness(0) opacity(0.55)"
      : status === "seen"
        ? "saturate(0) opacity(0.5)"
        : "none"

  return (
    <div className={`relative grid place-items-center ${className}`}>
      <svg
        className="absolute h-3/5 w-3/5 text-[var(--color-silhouette)]"
        viewBox="0 0 64 64"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="32" cy="25" r="15" />
        <path d="M10 58c2-15 10-23 22-23s20 8 22 23H10Z" />
      </svg>
      {spritePath && !failed && (
        <img
          src={spritePath}
          alt={name}
          className="relative z-[1] h-full w-full object-contain transition-all duration-200"
          style={{ imageRendering: "pixelated", filter }}
          onError={(event) => {
            event.currentTarget.hidden = true
            setFailed(true)
            console.warn(`[LuxDex] Local sprite failed to load for ${name}.`)
          }}
        />
      )}
      {(!spritePath || failed) && (
        <span className="sr-only">No local sprite available for {name}</span>
      )}
    </div>
  )
}
