import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import PokeTile from "./PokeTile"

const basePokemon = {
  id: "pichu",
  canonicalKey: "pichu",
  name: "Pichu",
  spritePath: "/assets/pokemon/sprites/pichu.png",
} as const

describe("collection state presentation", () => {
  it("renders unseen as a dark silhouette treatment", () => {
    render(<PokeTile pokemon={{ ...basePokemon, status: "unseen" }} />)
    expect(screen.getByRole("img", { name: "Pichu" })).toHaveStyle({
      filter: "brightness(0) opacity(0.55)",
    })
  })

  it("renders seen as faded and desaturated", () => {
    render(<PokeTile pokemon={{ ...basePokemon, status: "seen" }} />)
    expect(screen.getByRole("img", { name: "Pichu" })).toHaveStyle({
      filter: "saturate(0) opacity(0.5)",
    })
  })

  it("renders owned in full colour with a Poké Ball and never advances again", async () => {
    const action = vi.fn()
    const { container } = render(
      <PokeTile
        pokemon={{ ...basePokemon, status: "owned" }}
        onStatusAction={action}
      />,
    )
    expect(screen.getByRole("img", { name: "Pichu" })).toHaveStyle({ filter: "none" })
    expect(container.querySelector("svg circle[fill='var(--color-owned)']")).toBeInTheDocument()
    const owned = screen.getByRole("button", { name: "✓ Owned" })
    expect(owned).toBeDisabled()
    await userEvent.click(owned)
    expect(action).not.toHaveBeenCalled()
  })

  it("keeps navigation and quick advancement as separate actions", async () => {
    const select = vi.fn()
    const action = vi.fn()
    const user = userEvent.setup()
    render(
      <PokeTile
        pokemon={{ ...basePokemon, status: "unseen" }}
        onSelect={select}
        onStatusAction={action}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Mark Seen" }))
    expect(action).toHaveBeenCalledWith("pichu", "unseen")
    expect(select).not.toHaveBeenCalled()
  })
})
