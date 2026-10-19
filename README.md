# uxid

Prefixed, K-sortable identifiers a person can read, for TypeScript and
JavaScript. An id looks like `usr_01hf7yat0004h1`: the prefix names the
resource, and the body carries a time and randomness in Crockford Base32. It
is the same format as the Elixir [`uxid`](https://hex.pm/packages/uxid)
package, held to that package's conformance corpus.

## Why

An auto-increment key leaks how many rows a table holds and invites
enumeration. A random UUID fixes both but is long, unordered and anonymous: in
a log line, a URL or a support thread nobody can tell what it points at. A
uxid names its resource in its prefix, reads aloud without ambiguity, sorts by
creation time so it indexes well, and is generated in the application with no
coordination between nodes. Its size is tunable, a monotonic generator keeps a
burst within one millisecond unique and in order, and a deterministic mode maps
the same input to the same id.

Because the format is shared, an id made by this package is read by the Elixir
package, and the other way round, and a server and a client agree on what an
id says. The package has no runtime dependencies.

## Install

```bash
pnpm add uxid
```

## Basic usage

```ts
import { createMonotonic, decode, generate, isDeterministic, isValid } from "uxid";

// A random id with a prefix: "usr_" and a time-ordered body.
const id = generate({ prefix: "usr" });

// Read it back. A malformed id is a failing result, never a throw.
const read = decode(id);

if (!read.ok || read.value.prefix !== "usr" || read.value.deterministic) {
  throw new Error("a freshly generated id decodes to its prefix");
}

if (!isValid(id, { prefix: "usr" }) || isValid(id, { prefix: "cus" })) {
  throw new Error("an id is valid for its own prefix only");
}

// The same input gives the same id, every time.
const named = generate({ prefix: "usr", from: "alice@example.com" });

if (named !== "usr_zcvt7epac0t1ebcsjfyf7cwz25" || !isDeterministic(named)) {
  throw new Error("a deterministic id is a pure function of its input");
}

// Fix the time and the random bytes to reproduce an id exactly.
const fixed = generate({
  prefix: "cus",
  size: "s",
  time: 1700000000000,
  rand: new Uint8Array([1, 35]),
});

if (fixed !== "cus_01hf7yat0004h1") {
  throw new Error("fixed inputs give a fixed id");
}

// A monotonic generator is an object you hold; ids it makes sort in order.
const ids = createMonotonic({ prefix: "usr", size: "m" });
const first = ids.generate({ time: 1700000000000 });
const second = ids.generate({ time: 1700000000000 });

if (!(first < second)) {
  throw new Error("ids from one generator sort in the order they were made");
}
```

`generate` throws a `UxidError` when its options contradict each other or the
format; match on its `code`, which is stable, rather than on its message.

## Compatibility

- **Node:** `engines.node` in `package.json` is `>=20`.
- **Browsers, Deno and Bun:** these provide `globalThis.crypto.getRandomValues`,
  which is the default source of random bytes. Neither Deno nor Bun is run by
  this repository's gate.
- **React Native:** generation needs random bytes, and React Native's
  JavaScript engine may not provide `crypto.getRandomValues`. Install a
  polyfill that defines it before the first call, or pass a `byteSource`, a
  function that answers that many secure random bytes. Without either,
  `generate` and a monotonic generator's `generate` throw a `UxidError` with
  the code `byte_source_unavailable`. A run on React Native's engine is not part
  of this repository's gate, so none is claimed here.
- **No bytes needed:** `decode`, `isValid`, `isDeterministic` and
  `generate({ from })` use no random bytes, so they need nothing from the
  engine beyond the language. No run outside Node is part of this repository's
  gate.
- **Module formats:** ESM and CommonJS, each with type declarations.

```ts
import { generate } from "uxid";

// Any function that answers `count` secure random bytes will do. Here Web
// Crypto stands in; on a device it would call into a native module.
const byteSource = (count: number): Uint8Array =>
  globalThis.crypto.getRandomValues(new Uint8Array(count));

const id = generate({ prefix: "usr", byteSource });

if (!id.startsWith("usr_")) {
  throw new Error("an injected byte source feeds the random field");
}
```

The library never falls back to `Math.random`. Bytes passed directly through
`rand` exist for test vectors, and an id built from them is exactly as
guessable as those bytes.

## Upgrading

The 1.0 line is a new implementation of the uxid format. The `0.0.1` package
on npm was an earlier, separate piece of code: nothing from its API carries
over, and it was not built against the wire format or its corpus. Treat 1.0 as
a fresh install and read the API reference named in Documentation.

## Documentation

- Look up
  - The API reference: every exported function, option and type, built into
    `docs/api/` by `mise exec -- pnpm run docs` in a clone of this repository.
  - [The wire format](https://github.com/riddler/uxid-ts/blob/main/docs/wire-format.md):
    where the normative layout of an id lives, and which version of it this
    package follows.
  - [The changelog](https://github.com/riddler/uxid-ts/blob/main/CHANGELOG.md):
    what changed in each version.
- Understand
  - [Conformance](https://github.com/riddler/uxid-ts/tree/main/conformance):
    the corpus this package is checked against, vendored byte for byte from the
    reference implementation. It is the arbiter: every case in it passes, with
    no skip list.
  - [The Elixir package's guides](https://github.com/riddler/uxid-ex/tree/v2.10.0/guides):
    why an id has a prefix, a time and randomness, how sizes trade length for
    randomness, and how monotonic and deterministic ids behave.

## License

Available as open source under the terms of the [MIT License](https://github.com/riddler/uxid-ts/blob/main/LICENSE).
