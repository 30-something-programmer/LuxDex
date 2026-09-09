interface AreasRoute {
  view: "areas"
  groupKey: string | null
  locationKey: string | null
}

interface PokemonRoute {
  view: "pokemon"
  canonicalKey: string | null
}

interface PokedexRoute {
  view: "pokedex"
}

interface StudioRoute {
  view: "studio"
}

export type AppRoute = AreasRoute | PokemonRoute | PokedexRoute | StudioRoute

function decode(segment: string | undefined): string | null {
  if (!segment) return null
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

export function parseRoute(pathname: string): AppRoute {
  const [view, first, second] = pathname.split("/").filter(Boolean)
  if (view === "pokemon")
    return { view: "pokemon", canonicalKey: decode(first) }
  if (view === "pokedex") return { view: "pokedex" }
  if (view === "map-studio") return { view: "studio" }
  if (view === "areas") {
    return {
      view: "areas",
      groupKey: decode(first),
      locationKey: decode(second),
    }
  }
  return { view: "areas", groupKey: null, locationKey: null }
}

export function routePath(route: AppRoute): string {
  if (route.view === "studio") return "/map-studio"
  if (route.view === "pokedex") return "/pokedex"
  if (route.view === "pokemon") {
    return route.canonicalKey
      ? `/pokemon/${encodeURIComponent(route.canonicalKey)}`
      : "/pokemon"
  }
  if (!route.groupKey) return "/areas"
  const groupPath = `/areas/${encodeURIComponent(route.groupKey)}`
  return route.locationKey
    ? `${groupPath}/${encodeURIComponent(route.locationKey)}`
    : groupPath
}
