import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"
import MelemeleMap from "./MelemeleMap"

it("expands the persisted location overlay and keeps selection interactive", async () => {
  const user = userEvent.setup()
  const select = vi.fn()
  render(
    <MelemeleMap
      locations={[{ id: "route-1", name: "Route 1", hasEncounters: true }]}
      regions={[
        {
          locationKey: "route-1",
          points: [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
        },
      ]}
      selectedLocationId="route-1"
      onSelectLocation={select}
    />,
  )

  await user.click(screen.getByRole("button", { name: "Expand map" }))
  expect(
    screen.getByRole("dialog", { name: "Expanded Melemele map" }),
  ).toBeInTheDocument()
  await user.click(screen.getAllByRole("button", { name: "Open Route 1" })[1])
  expect(select).toHaveBeenCalledWith("route-1")
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})
