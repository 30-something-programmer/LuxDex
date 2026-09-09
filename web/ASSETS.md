# Runtime assets

LuxDex serves normal UI assets locally from `public/assets/`. Nunito and JetBrains Mono are bundled with their OFL licences and can be reacquired from a pinned upstream revision with `scripts/pull-assets.ps1`.

Pokémon sprites will live under `public/assets/sprites/pokemon/` and are resolved centrally by `src/lib/sprites.ts`. No sprites are bundled in Pass 1.5: the Figma export used a remote PokéAPI/GitHub lookup without a vetted application asset manifest. The recovered presentation components use a local visual fallback when no backend-provided sprite asset key is available, so normal shell rendering does not make remote requests. A later asset pass must record provenance/licensing in the acquisition script and expose only local asset keys from the backend.
