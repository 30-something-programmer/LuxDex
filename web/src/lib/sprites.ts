const LOCAL_SPRITE_ROOT = "/assets/sprites/pokemon"

/**
 * Resolve a backend-provided, filesystem-safe sprite asset key locally.
 * The frontend does not contain a species-to-sprite dataset; that mapping will
 * be supplied by a future API after asset provenance is established.
 */
export function getLocalSpritePath(
  assetKey: string | null | undefined,
): string | null {
  if (!assetKey || !/^[a-z0-9][a-z0-9._-]*$/i.test(assetKey)) return null
  return `${LOCAL_SPRITE_ROOT}/${assetKey}.png`
}
