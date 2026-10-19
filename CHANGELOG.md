### 1.0.0 / 2026-10-19

The first release of the rewrite: prefixed, K-sortable ids, wire-compatible with the Elixir `uxid` package. It covers generation (random, deterministic and monotonic), decoding and the validity checks, with zero runtime dependencies and no Node built-in in the library source; on Node it needs 20 or later. It is checked against the conformance corpus vendored from riddler/uxid-ex at the tag `v2.10.0`, and every case in it passes with no skip list.

#### Added

- `generate(options?)` returns a time-based id: a millisecond time and a random field, under an optional prefix. The size (`xs`, `s`, `m`, `l` or `xl`, or a long spelling) fixes the random field's width and defaults to `xl`; `compactTime`, `case`, `delimiter`, `time` and `randSize` shape the id, and `rand` fixes the random bytes for test vectors. Random bytes come from `globalThis.crypto.getRandomValues` by default, or from the `byteSource` option on an engine that has none.
- A refused request throws `UxidError`, whose `code` names the refusal: `generate` refuses with `compact_time_out_of_range`, `rand_width_mismatch`, `rand_size_too_large` and `invalid_option`, and with `byte_source_unavailable` when random bytes are needed and neither the platform nor the options supply them.
- `createMonotonic(options?)` returns a monotonic generator, an object whose `generate(options?)` makes time-based ids that stay unique and in order within one millisecond. The generator keeps the last time and the last random value per prefix and random width in the object itself; the library keeps no state of its own. Within a millisecond, or when the clock moves back, an id carries the last time and the last value plus a step drawn uniformly from 1 to 2^(4w) for a field of w bytes; a step that overflows the field moves the time one millisecond forward with a fresh value. A monotonic `xs` uses compact time by default.
- The `draws` option replaces the generator's random values (a fresh value and a step, each answered as a `bigint` or a safe integer) so known draws can be replayed; by default they come from the byte source, the step masked from whole random bits so that every step is equally likely.
- The generator refuses `from` with the error code `from_with_monotonic` and `rand` with `rand_with_monotonic`, and refuses standard time at `xs`, a random width of 0 and a draw outside its range with `invalid_option`.
- `generate({ from })` returns a deterministic id: the same prefix, string and size always give the same id, hashed with a SHA-256 bundled as plain synchronous TypeScript, so it needs no platform crypto.
- `generate` refuses `rand` together with `from` with the error code `rand_with_from`, and refuses a `from` or prefix holding a lone surrogate with `invalid_option`.
- `decode(id, options?)` reads an id back to `{ ok: true, value }`, where `value` carries the prefix (or `null`), the size, whether the time is compact, whether the body is deterministic and the time (`null` for a deterministic body), or to `{ ok: false, error }` with the refusal `empty`, `invalid_length` or `invalid_character`. It never throws on a malformed id. The body lengths 10 and 18 are read as standard time. `options.now` sets the clock a compact time takes its high bits from, and `options.delimiter` the delimiter.
- `isValid(id, options?)` answers whether `decode` answers a value, and, given `options.prefix`, whether the id carries that prefix. `isDeterministic(id, options?)` answers whether the id is a well-formed deterministic one.

#### Removed

- The 0.0.1 placeholder API is gone: its default export, an empty class with no methods, is removed, and the package now has named exports only. Import the functions by name, as in `import { generate } from "uxid"`.

### 0.0.1 / 2020-06-17

* Birthday!
