# Local sprite vendor provenance

The sprite art referenced by `luxdex.pokemon_sprite_asset` is **not** committed to
this repository and is **not** fetched automatically. It is copied onto disk by a
maintainer from a local, manually downloaded copy of
[`HybridShivam/Pokemon`](https://github.com/HybridShivam/Pokemon) into
`web/public/assets/pokemon/sprites/`.

## Why this differs from the taxonomy data pipeline

The Pokémon taxonomy CSVs (species, forms, dex numbers, etc.) still come from a
pinned commit of `PokeAPI/pokeapi`, an openly licensed dataset, and are acquired
and checked into the repository as before (see `acquire.py` and
`source-lock.json`).

The sprite art itself is different: `HybridShivam/Pokemon` describes its images as
official Sugimori artwork sourced from Bulbapedia, and does not include a LICENSE
file granting redistribution rights. Because of that:

- The sprite PNGs are kept out of version control (`.gitignore`d) rather than
  committed to this public repository.
- There is no live acquisition step for them; a maintainer vendors them locally
  before running the app, and `source-lock.json`'s `sprites` array records the
  checksums/dimensions of whatever is currently vendored so the app can verify its
  local sprite directory is intact.

## Mapping method

Each target form (species ≤ national dex #807, introduced no later than Ultra
Sun/Ultra Moon) is matched to a file in the vendor source by national dex number
and a normalised form-suffix comparison. Where no exact per-form image exists in
that source, the form falls back to its species' default artwork instead of being
left without a sprite. `sprite_family` on each `pokemon_sprite_asset` row records
which case applies (`vendored-local/hd-box-art` for an exact match,
`vendored-local/hd-box-art-fallback` for a species-default fallback).

## Regenerating the local sprite set

A fresh clone of this repository does not include the sprite PNGs. To restore
them, a maintainer needs their own local copy of `HybridShivam/Pokemon`'s
`assets/images` directory and can re-run the mapping/vendoring step to populate
`web/public/assets/pokemon/sprites/` and refresh the `sprites` section of
`source-lock.json`.
