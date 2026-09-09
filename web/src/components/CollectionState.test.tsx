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

  it("renders owned in full colour with a coloured Poké Ball", () => {
    render(<PokeTile pokemon={{ ...basePokemon, status: "owned" }} />)
    expect(screen.getByRole("img", { name: "Pichu" })).toHaveStyle({ filter: "none" })
    expect(
      screen.getByRole("button", { name: "Pichu is owned" }),
    ).toBeDisabled()
  })

  it("shows a closed eye and grey Poké Ball for an unseen card", () => {
    render(<PokeTile pokemon={{ ...basePokemon, status: "unseen" }} />)
    expect(
      screen.getByRole("button", { name: "Mark Pichu as seen" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Mark Pichu as owned" }),
    ).toBeInTheDocument()
  })

  it("clicking the eye on an unseen card marks it seen and does not select it", async () => {
    const select = vi.fn()
    const markSeen = vi.fn()
    const user = userEvent.setup()
    render(
      <PokeTile
        pokemon={{ ...basePokemon, status: "unseen" }}
        onSelect={select}
        onMarkSeen={markSeen}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Mark Pichu as seen" }))
    expect(markSeen).toHaveBeenCalledWith("pichu", "unseen")
    expect(select).not.toHaveBeenCalled()
  })

  it("shows an open eye once seen and never downgrades on click", async () => {
    const markSeen = vi.fn()
    const user = userEvent.setup()
    render(
      <PokeTile
        pokemon={{ ...basePokemon, status: "seen" }}
        onMarkSeen={markSeen}
      />,
    )
    const eye = screen.getByRole("button", { name: "Pichu has been seen" })
    expect(eye).toBeDisabled()
    await user.click(eye)
    expect(markSeen).not.toHaveBeenCalled()
  })

  it("clicking the grey Poké Ball on an unseen card sets it owned directly", async () => {
    const markOwned = vi.fn()
    const user = userEvent.setup()
    render(
      <PokeTile
        pokemon={{ ...basePokemon, status: "unseen" }}
        onMarkOwned={markOwned}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Mark Pichu as owned" }))
    expect(markOwned).toHaveBeenCalledWith("pichu", "unseen")
  })

  it("clicking the grey Poké Ball on a seen card sets it owned", async () => {
    const markOwned = vi.fn()
    const user = userEvent.setup()
    render(
      <PokeTile
        pokemon={{ ...basePokemon, status: "seen" }}
        onMarkOwned={markOwned}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Mark Pichu as owned" }))
    expect(markOwned).toHaveBeenCalledWith("pichu", "seen")
  })

  it("disables the Poké Ball once owned and never re-fires", async () => {
    const markOwned = vi.fn()
    const user = userEvent.setup()
    render(
      <PokeTile
        pokemon={{ ...basePokemon, status: "owned" }}
        onMarkOwned={markOwned}
      />,
    )
    const ball = screen.getByRole("button", { name: "Pichu is owned" })
    expect(ball).toBeDisabled()
    await user.click(ball)
    expect(markOwned).not.toHaveBeenCalled()
  })

  it("keeps navigation and quick actions as separate controls", async () => {
    const select = vi.fn()
    const markOwned = vi.fn()
    const user = userEvent.setup()
    render(
      <PokeTile
        pokemon={{ ...basePokemon, status: "unseen" }}
        onSelect={select}
        onMarkOwned={markOwned}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Mark Pichu as owned" }))
    expect(markOwned).toHaveBeenCalledWith("pichu", "unseen")
    expect(select).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Open Pichu details" }))
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalKey: "pichu" }),
    )
  })
})
