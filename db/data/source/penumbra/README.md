# Penumbra source data

`wild-encounters.txt` is the authoritative raw Penumbra wild-encounter export supplied to LuxDex. It is preserved byte-for-byte and is the sole input to the Pass 2 encounter ingestion pipeline.

The loader calculates source metadata, parses and validates the complete file in memory, and publishes the result transactionally to PostgreSQL. Do not edit or normalise this file in place. Reproducibility depends on retaining the original bytes and source ordering.

For the current source, the parser reports 10,078 physical lines and 9,284 nonblank lines. The previously supplied “Lines: 9,284” metadata therefore describes nonblank lines; both values are retained in `source_dataset`.
