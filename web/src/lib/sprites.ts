const LOCAL_SPRITE_PREFIX = "/assets/pokemon/sprites/"

/**
 * Resolve a backend-provided, filesystem-safe sprite asset key locally.
 * Canonical form-to-asset relationships remain in PostgreSQL/the API.
 */
export function normalizeLocalSpritePath(
  spritePath: string | null | undefined,
): string | null {
  if (!spritePath || !spritePath.startsWith(LOCAL_SPRITE_PREFIX)) return null
  const filename = spritePath.slice(LOCAL_SPRITE_PREFIX.length)
  if (!/^[a-z0-9][a-z0-9._-]*\.png$/i.test(filename)) return null
  return `${LOCAL_SPRITE_PREFIX}${filename}`
}
