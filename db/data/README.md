# LuxDex data

- `source/` contains authoritative raw datasets preserved without content transformation. These files are inputs for future ingestion and provide traceability back to their source form.
- `canonical/` is reserved for derived or normalised reference data that can be replayed after schema construction. SQL publication files placed here must be idempotent.

Do not edit raw source data to make it fit an application schema, and do not expose source files directly to the frontend. Future ingestion should read the source, validate it, and publish derived output separately.

