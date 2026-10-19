### Added

- `generate({ from })` returns a deterministic id: the same prefix, string and size always give the same id, hashed with a SHA-256 bundled as plain synchronous TypeScript, so it needs no platform crypto.
- `generate` refuses `rand` together with `from` with the error code `rand_with_from`, and refuses a `from` or prefix holding a lone surrogate with `invalid_option`.
