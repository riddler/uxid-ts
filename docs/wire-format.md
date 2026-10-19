# Wire format

This package does not restate the format. The normative layout of a uxid - the
alphabet, the bit packing, the sizes, the prefix grammar, the time and
deterministic bodies, and decoding - is the reference implementation's guide,
read at the release tag this package's vendored corpus names:

[UXID wire format, at v2.10.0](https://github.com/riddler/uxid-ex/blob/v2.10.0/guides/wire-format.md)

The tag is the one recorded in `conformance/SOURCE.json`, beside the commit it
names and the hash of the corpus. A change to that file moves the tag; this
pointer moves with it.

## The corpus is the arbiter

The conformance corpus is vendored under `conformance/`, byte for byte from
the same tag, and the test suite runs every case in it with no skip list.
This package is held to the corpus: a case it cannot pass is a bug here or a
question for the reference implementation, never a skip, and a difference
between the guide and the corpus is raised there rather than worked round here.

## What this package decides for itself

The API: the function and option names, the TypeScript types, the result
shapes and the error codes a caller matches on. Those are documented in the
API reference built from `src/` (`mise exec -- pnpm run docs`).
