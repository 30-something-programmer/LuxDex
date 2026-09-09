# Canonical geography research

These CSV files are the reviewed interpretation layer between immutable Penumbra encounter tables and player-facing places. They are loaded only after the raw encounter source, canonical Pokémon master, and Pokémon identity map exist.

- `area-groups.csv` and `locations.csv` own navigation hierarchy and display order.
- `encounter-places.csv` defines meaningful verified encounter contexts and methods.
- `table-mappings.csv` maps stable raw `(source_sequence, source_table_number)` identities to places. Several raw tables may map to one place; one raw map block may map across locations.
- `source-references.csv` records structured and human research provenance.
- `mapping-evidence.csv` gives every verified mapping an explainable evidence chain.
- `geography-coverage-report.json` is regenerated from the complete 397-table source inventory and lists every unresolved table by raw map block.

Unresolved raw tables have no mapping row. They are not assigned invented player-facing labels. Only `verified` mappings are persisted or returned as canonical geography.

The pinned vanilla Ultra Sun dump supplies raw structural identity and the original pool for matching. Location references supply the player-facing label and encounter method. Penumbra's modified Pokémon contents are never compared as if they were vanilla data.
