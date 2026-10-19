// The hash rule: the vendored corpus is the one it says it is.
//
//   node scripts/corpus-check.mjs [conformance directory]
//
// `conformance/` holds the conformance corpus of the Elixir uxid package,
// copied byte for byte from the release tag `conformance/SOURCE.json` names:
// the case files, `manifest.json`, the schemas and the corpus README. The
// generator source under the reference's `conformance/source/` is not copied;
// a runner does not read it and the hash does not cover it.
//
// The rule is the one the corpus README states under "Running the cases":
// the SHA-256 of the case files' bytes, concatenated in the order the
// manifest's `files` lists them, written as `sha256:` and lowercase hex. It
// must equal the `corpus_hash` in the vendored manifest and the one in
// `SOURCE.json`, and each case file's line count must equal its `case_count`.
// A mismatch is a hard failure. It is never repaired by rewriting a hash: the
// hash is what a claim of conformance is anchored to, and a hash rewritten to
// match whatever is on disk anchors it to nothing.
//
// The hash covers the concatenation, so the digest alone says that something
// moved, not which file. A failure therefore prints each case file's own
// digest and line count, to compare against the tag.
//
// The optional argument points the check at another directory; the gate runs
// it with none.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KNOWN_CORPUS_VERSION = 1;
const NOT_CASE_FILES = new Set(["manifest.json", "SOURCE.json"]);

const root =
  process.argv[2] === undefined
    ? fileURLToPath(new URL("../conformance/", import.meta.url))
    : resolve(process.argv[2]);

function die(message) {
  console.error(`corpus:check: ${message}`);
  process.exit(1);
}

function readJson(name) {
  let text;
  try {
    text = readFileSync(join(root, name), "utf8");
  } catch {
    die(`cannot read conformance/${name}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    die(`conformance/${name} is not JSON: ${error.message}`);
  }
}

const manifest = readJson("manifest.json");
const source = readJson("SOURCE.json");
const problems = [];

if (manifest.corpus_version !== KNOWN_CORPUS_VERSION) {
  die(
    `the vendored manifest says corpus_version ${manifest.corpus_version}; this runner knows ${KNOWN_CORPUS_VERSION}`,
  );
}
if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
  die("the vendored manifest lists no case files");
}
for (const key of ["repo", "tag", "sha", "corpus_hash"]) {
  if (typeof source[key] !== "string" || source[key] === "") {
    problems.push(`SOURCE.json carries no ${key}`);
  }
}

const digest = createHash("sha256");
const perFile = [];
for (const entry of manifest.files) {
  let bytes;
  try {
    bytes = readFileSync(join(root, entry.file));
  } catch {
    die(`conformance/${entry.file} is missing, and the manifest lists it`);
  }
  digest.update(bytes);
  const lines = bytes
    .toString("utf8")
    .split("\n")
    .filter((line) => line !== "").length;
  perFile.push({
    file: entry.file,
    digest: createHash("sha256").update(bytes).digest("hex"),
    lines,
  });
  if (lines !== entry.case_count) {
    problems.push(
      `conformance/${entry.file} holds ${lines} cases; the manifest says ${entry.case_count}`,
    );
  }
}

// A case file the manifest does not list contributes nothing to the hash, so
// nothing else here would see it.
const listed = new Set(manifest.files.map((entry) => entry.file));
for (const name of readdirSync(root).sort()) {
  if (name.endsWith(".json") && !NOT_CASE_FILES.has(name) && !listed.has(name)) {
    problems.push(`conformance/${name} is not listed in the vendored manifest`);
  }
}

const observed = `sha256:${digest.digest("hex")}`;
if (observed !== manifest.corpus_hash) {
  problems.push(`the case files hash to ${observed}; the manifest pins ${manifest.corpus_hash}`);
}
if (observed !== source.corpus_hash) {
  problems.push(`the case files hash to ${observed}; SOURCE.json pins ${source.corpus_hash}`);
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`corpus:check: ${problem}`);
  console.error("corpus:check: per-file digests, to find what moved:");
  for (const entry of perFile) {
    console.error(`    conformance/${entry.file}  ${entry.digest}  ${entry.lines} cases`);
  }
  console.error(
    "corpus:check: the fix is to restore the vendored bytes from the tag. Never rewrite a hash to match.",
  );
  process.exit(1);
}

console.log(`corpus:check: ${source.repo} at ${source.tag} (${source.sha}), ${observed}`);
