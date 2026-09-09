import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import PokemonArtwork from "./PokemonArtwork"

describe("PokemonArtwork", () => {
  it("uses a backend-provided local sprite path", () => {
    render(
      <PokemonArtwork
        name="Pichu"
        spritePath="/assets/pokemon/sprites/pichu.png"
        status="owned"
      />,
    )
    expect(screen.getByRole("img", { name: "Pichu" })).toHaveAttribute(
      "src",
      "/assets/pokemon/sprites/pichu.png",
    )
    expect(screen.getByRole("img", { name: "Pichu" })).toHaveAttribute(
      "loading",
      "lazy",
    )
  })

  it("renders a quiet deliberate missing-sprite placeholder", () => {
    render(
      <PokemonArtwork
        name="Missing Form"
        spritePath={null}
        status="owned"
      />,
    )
    expect(
      screen.getByText("No local sprite available for Missing Form"),
    ).toBeInTheDocument()
  })

  it("rejects external sprite URLs", () => {
    render(
      <PokemonArtwork
        name="Remote"
        spritePath="https://example.com/remote.png"
        status="owned"
      />,
    )
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })
})
