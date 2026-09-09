const LOCAL_SPRITE_ROOT = "/assets/pokemon/sprites"

/**
 * Resolve a backend-provided, filesystem-safe sprite asset key locally.
 * Canonical form-to-asset relationships remain in PostgreSQL/the API.
 */
export function getLocalSpritePath(
  assetKey: string | null | undefined,
): string | null {
  if (!assetKey || !/^[a-z0-9][a-z0-9._-]*$/i.test(assetKey)) return null
  return `${LOCAL_SPRITE_ROOT}/${assetKey}.png`
}
