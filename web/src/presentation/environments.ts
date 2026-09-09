// Presentation-only mood backgrounds for encounter-place sections. Maps a
// VERIFIED backend encounter method (and, where a method alone is too
// coarse — "grass" covers everything from a meadow to a bay overlook — the
// verified place's own display text) to a lightweight local CSS treatment.
// This is intentionally temporary flavour, not real per-location geography:
// no new place/location data is invented here, only a style token chosen
// from data the backend already returned.
export type EnvironmentStyle =
  | "water"
  | "beach-water"
  | "tall-grass"
  | "meadow"
  | "meadow-ocean"
  | "cave"
  | "urban"
  | "forest"

const BEACH_PATTERN = /beach|shore|sand/
const BAY_PATTERN = /\bbay\b|overlook|\bsea\b|ocean|\bcoast/
const CAVE_PATTERN = /\bcave\b|cavern|tunnel/
const TALL_GRASS_PATTERN = /\btall grass\b|deep grass|thick grass|dense grass/
const FOREST_PATTERN = /forest|jungle|dense wood|thicket/

export function environmentStyleFor(
  method: string,
  displayName: string,
  subtitle?: string | null,
): EnvironmentStyle {
  const text = `${displayName} ${subtitle ?? ""}`.toLowerCase()

  switch (method) {
    case "surf":
    case "fishing":
    case "bubbling_fishing":
      return BEACH_PATTERN.test(text) ? "beach-water" : "water"
    case "moving_shadow":
      return "forest"
    case "berry_pile":
      return "meadow"
    default:
      if (BAY_PATTERN.test(text)) return "meadow-ocean"
      if (CAVE_PATTERN.test(text)) return "cave"
      if (TALL_GRASS_PATTERN.test(text)) return "tall-grass"
      if (FOREST_PATTERN.test(text)) return "forest"
      return "meadow"
  }
}

export function environmentClassName(style: EnvironmentStyle): string {
  return `env-${style}`
}
