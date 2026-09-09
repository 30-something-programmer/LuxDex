# Runtime assets

LuxDex serves normal UI assets locally from `public/assets/`. Nunito and JetBrains Mono are bundled with their OFL licences and can be reacquired from a pinned upstream revision with `scripts/pull-assets.ps1`.

Pokémon sprites live under `public/assets/pokemon/sprites/` and are exposed by the backend as local paths. They are exact files from PokeAPI's `generation-vii/ultra-sun-ultra-moon` sprite family, pinned at commit `712e6d9f915a1d2bdfbe991d04eea75e3ad950e7`. `db/data/source/pokemon/source-lock.json` records every local path, upstream path, checksum, byte count, dimensions, and any form without an exact asset. The donor licence is preserved at `db/data/source/pokemon/pokeapi-sprites/712e6d9f915a1d2bdfbe991d04eea75e3ad950e7/LICENCE.txt`.

Run `scripts/pull-pokemon-data.ps1` only for explicit source acquisition. Normal build, startup, and browser rendering use committed local assets and do not contact an image host. The presentation shell still renders its neutral fallback when an exact canonical form sprite is unavailable.
