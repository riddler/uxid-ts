### Added

- `decode(id, options?)` reads an id back to `{ ok: true, value }`, where `value` carries the prefix (or `null`), the size, whether the time is compact, whether the body is deterministic and the time (`null` for a deterministic body), or to `{ ok: false, error }` with the refusal `empty`, `invalid_length` or `invalid_character`. It never throws on a malformed id. The body lengths 10 and 18 are read as standard time. `options.now` sets the clock a compact time takes its high bits from, and `options.delimiter` the delimiter.
- `isValid(id, options?)` answers whether `decode` answers a value, and, given `options.prefix`, whether the id carries that prefix. `isDeterministic(id, options?)` answers whether the id is a well-formed deterministic one.
