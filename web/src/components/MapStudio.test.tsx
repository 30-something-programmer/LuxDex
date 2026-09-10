import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"
import type { StudioDocumentResponse } from "../api/types"
import MapStudio from "./MapStudio"

const studioDocument: StudioDocumentResponse = {
  nodes: [
    {
      node_key: "world",
      parent_key: null,
      layer: 1,
      node_type: "world",
      canonical_key: null,
      display_name: "World",
      asset_path: null,
      geometry: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    },
    {
      node_key: "island:melemele",
      parent_key: "world",
      layer: 2,
      node_type: "island",
      canonical_key: "melemele",
      display_name: "Melemele",
      asset_path: "/assets/maps/melemele.png",
      geometry: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    },
    {
      node_key: "location:route-1",
      parent_key: "island:melemele",
      layer: 3,
      node_type: "location",
      canonical_key: "route-1",
      display_name: "Route 1",
      asset_path: null,
      geometry: [
        [0.2, 0.1],
        [0.6, 0.1],
        [0.6, 0.5],
        [0.2, 0.5],
      ],
    },
    {
      node_key: "zone:route-1-bay",
      parent_key: "location:route-1",
      layer: 4,
      node_type: "zone",
      canonical_key: "route-1-bay",
      display_name: "Grass Overlooking the Bay",
      asset_path: null,
      geometry: [
        [0.2, 0.2],
        [0.8, 0.2],
        [0.8, 0.8],
        [0.2, 0.8],
      ],
    },
  ],
  pokemon: [],
  placements: [],
}

vi.mock("../api/mapStudio", () => ({
  getMapStudio: vi.fn(() => Promise.resolve(studioDocument)),
  saveStudioGeometry: vi.fn(() => Promise.resolve()),
  deleteStudioGeometry: vi.fn(() => Promise.resolve()),
  saveStudioPlacement: vi.fn(() => Promise.resolve()),
}))

it("uses an interactive island overview for L2 and a parent crop for L4", async () => {
  const user = userEvent.setup()
  render(<MapStudio onCollectionChange={vi.fn()} />)

  expect(
    await screen.findByText(/Island overview · move over a mapped location/),
  ).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Create polygon" })).toBeDisabled()
  expect(screen.getByTestId("studio-canvas")).toHaveAttribute(
    "data-context",
    "island-overview",
  )

  const routeRegion = screen.getByRole("button", { name: "Open Route 1" })
  await user.hover(routeRegion)
  expect(screen.getByTestId("studio-context-help")).toHaveTextContent(
    "Hovering: Route 1",
  )
  await user.click(routeRegion)
  expect(screen.getByTestId("studio-canvas")).toHaveAttribute(
    "data-context",
    "location",
  )

  await user.click(
    screen.getByRole("button", { name: /L4 Grass Overlooking the Bay/ }),
  )
  await waitFor(() =>
    expect(screen.getByTestId("studio-canvas")).toHaveAttribute(
      "data-context",
      "location-crop",
    ),
  )
  const croppedMap = screen.getByTestId("studio-cropped-map")
  const [, , width, height] = croppedMap
    .getAttribute("data-crop")!
    .split(",")
    .map(Number)
  expect(width).toBeCloseTo(0.4)
  expect(height).toBeCloseTo(0.4)
  expect(screen.getByTestId("studio-context-help")).toHaveTextContent(
    "Zoomed crop of Route 1",
  )
})
