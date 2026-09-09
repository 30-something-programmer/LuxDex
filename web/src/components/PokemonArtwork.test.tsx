import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PokemonArtwork from "./PokemonArtwork"

describe("PokemonArtwork", () => {
  it("uses a backend-provided local sprite path", () => {
    render(
      <PokemonArtwork
        name="Pichu"
        spritePath="/assets/pokemon/sprites/pichu.png"
        status="untracked"
      />,
    )
    expect(screen.getByRole("img", { name: "Pichu" })).toHaveAttribute(
      "src",
      "/assets/pokemon/sprites/pichu.png",
    )
  })

  it("renders and reports a deliberate missing-sprite placeholder", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    render(
      <PokemonArtwork
        name="Missing Form"
        spritePath={null}
        status="untracked"
      />,
    )
    expect(
      screen.getByText("No local sprite available for Missing Form"),
    ).toBeInTheDocument()
    expect(warn).toHaveBeenCalledWith(
      "[LuxDex] Missing local sprite for Missing Form.",
    )
  })

  it("rejects external sprite URLs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    render(
      <PokemonArtwork
        name="Remote"
        spritePath="https://example.com/remote.png"
        status="untracked"
      />,
    )
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(warn).toHaveBeenCalled()
  })
})
