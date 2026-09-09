# USUM research donors

This directory preserves structured Pokémon Ultra Sun and Ultra Moon source material used to research the player-facing geography layer. Donor data is never substituted for Penumbra encounter contents.

`vanilla-encounters/` contains SciresM's vanilla Pokémon Ultra Sun encounter-table dump at the exact commit and checksum recorded in `source-lock.json`. It is used only to validate that Penumbra retains the raw USUM map/table framework and to explain table semantics when a separate location reference confirms the player-facing place or method.

Reproduce the pinned file with:

```powershell
./scripts/pull-usum-geography-source.ps1
```

Human-readable web research is referenced from the canonical evidence CSV instead of copying arbitrary pages into the repository.
