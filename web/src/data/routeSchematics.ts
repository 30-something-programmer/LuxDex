// Types for future spatial route map support.
//
// When authoritative map assets exist for a route (e.g. an official or
// community-verified route image with confirmed encounter-zone overlays),
// register them here. AreasView can then switch from encounter cards to a
// spatial overlay automatically when an asset is available.
//
// Do not fabricate zone positions or invent geography. Zones should only be
// added here when their physical location within the route is confirmed.

export interface RouteMapZone {
  tableIndex: number;
  label: string;
  // SVG polygon points within the image coordinate space (pixels)
  shape: string;
  centerX: number;
  centerY: number;
}

export interface RouteMapAsset {
  areaId: string;
  // URL or import path to the authoritative route image
  image: string;
  imageWidth: number;
  imageHeight: number;
  // Verified encounter-zone overlays positioned on the image
  zones: RouteMapZone[];
}

// Registry of verified route map assets.
// Empty until authoritative assets are provided — do not add placeholder data.
const ROUTE_MAP_ASSETS: RouteMapAsset[] = [];

export function getRouteMapAsset(areaId: string): RouteMapAsset | undefined {
  return ROUTE_MAP_ASSETS.find(a => a.areaId === areaId);
}
