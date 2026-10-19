// The conformance corpus, run case by case: every line of every case file the
// vendored manifest lists, by its kind, as the corpus README's "Running the
// cases" lays out. There is no skip list; a case this package cannot pass
// fails here.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createMonotonic,
  decode,
  type GenerateOptions,
  generate,
  type MonotonicDraws,
  type MonotonicGenerateOptions,
  type Size,
  UxidError,
} from "../src/index.js";

const ROOT = new URL("../conformance/", import.meta.url);

interface ManifestEntry {
  readonly kind: string;
  readonly file: string;
  readonly case_count: number;
}

interface Manifest {
  readonly corpus_version: number;
  readonly files: readonly ManifestEntry[];
  readonly corpus_hash: string;
}

interface Case {
  readonly id: string;
  readonly input: unknown;
  readonly expected?: unknown;
  readonly expected_error?: string;
}

const read = (name: string) => readFileSync(new URL(name, ROOT));
const manifest = JSON.parse(read("manifest.json").toString("utf8")) as Manifest;

const casesOf = (entry: ManifestEntry): Case[] =>
  read(entry.file)
    .toString("utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Case);

const bytes = (hex: string) =>
  new Uint8Array((hex.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)));

/**
 * The corpus spells a request's options as the Elixir package does; this maps
 * each onto this package's name. A `null` or `""` prefix is no prefix, as the
 * README reads both. An option this map does not know fails the case, so a
 * later corpus with a new option cannot pass by having it ignored.
 */
function options(input: Record<string, unknown>): GenerateOptions {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case "prefix":
        if (value !== null && value !== "") out.prefix = value;
        break;
      case "size":
      case "case":
      case "time":
      case "from":
        out[key] = value;
        break;
      case "compact":
        out.compactTime = value;
        break;
      case "rand":
        out.rand = bytes(value as string);
        break;
      case "rand_size":
        out.randSize = value;
        break;
      default:
        throw new Error(`the corpus option ${key} has no mapping in this runner`);
    }
  }
  return out as GenerateOptions;
}

function refusal(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof UxidError) return error.code;
    throw error;
  }
  return "no refusal";
}

/**
 * Draws replayed from lists: every seed comes from `seeds` and every step from
 * `steps`, in order. A draw past the end of a list answers 0 for a seed and 1
 * for a step and is counted, so a generator that draws more than the case
 * carries answers a wrong id or fails the count, rather than crashing before
 * the assertions run.
 */
function replay(seeds: readonly number[], steps: readonly number[]) {
  const seedQueue = [...seeds];
  const stepQueue = [...steps];
  let overdrawn = 0;
  const take = (queue: number[], fallback: number): number => {
    const next = queue.shift();
    if (next !== undefined) return next;
    overdrawn++;
    return fallback;
  };
  const draws: MonotonicDraws = {
    seed: () => take(seedQueue, 0),
    step: () => take(stepQueue, 1),
  };
  return { draws, left: () => seedQueue.length + stepQueue.length, overdrawn: () => overdrawn };
}

// A decoder clock inside the window the corpus README names for its compact
// cases: from 1699913600000 inclusive to 2164577117183 exclusive.
const CLOCK = 1_700_000_000_000;
const WINDOW_ENDS = [1_699_913_600_000, 2_164_577_117_182];

interface MonotonicInput {
  readonly prefix: string | null;
  readonly size: Size;
  readonly compact: boolean;
  readonly times: readonly number[];
  readonly initial_seed: number;
  readonly steps: readonly number[];
  readonly overflow_seed: number | null;
}

const runners: Readonly<Record<string, (c: Case) => void>> = {
  // Sabotage: making the last short group in `encodeBytes` shift left (as RFC
  // 4648 pads) turns the rand-all-ones and partial-width cases red.
  encode: (c) => {
    expect(generate(options(c.input as Record<string, unknown>))).toBe(c.expected);
  },

  // Sabotage: leaving the `count` byte out of the hash input in
  // `deterministicBody` turns every case red.
  deterministic: (c) => {
    expect(generate(options(c.input as Record<string, unknown>))).toBe(c.expected);
  },

  // Sabotage: reading every first character's full 5 bits instead of its low
  // 3 in `standardTime` turns the two reads-as-standard cases red; dropping
  // the one-window subtraction in `compactTime` turns the guard case red at
  // the window's far end.
  decode: (c) => {
    for (const now of [CLOCK, ...WINDOW_ENDS]) {
      expect(decode(c.input, { now })).toEqual({ ok: true, value: c.expected });
    }
  },

  // Sabotage: counting the body's length in UTF-16 units rather than UTF-8
  // bytes in `refuse` turns the two non-ASCII cases red; deleting the marker
  // guard in `encodeTime`, the width check in `fixed`, the cap check in
  // `readWidth`, the `rand` check on the `from` path of `generate`, or the
  // `from` or `rand` check in `refuseConflicts` turns its case red.
  invalid: (c) => {
    const input = c.input as {
      decode?: string;
      generate?: Record<string, unknown> & { monotonic?: boolean };
    };
    if (input.decode !== undefined) {
      expect(decode(input.decode)).toEqual({ ok: false, error: c.expected_error });
      return;
    }
    if (input.generate === undefined) throw new Error("an invalid case with neither input");
    const { monotonic, ...rest } = input.generate;
    const request = options(rest);
    if (monotonic === true) {
      // Draws enough for one id, so a generator that let the request through
      // would answer an id rather than fail for want of a draw.
      const generator = createMonotonic({ draws: replay([0], []).draws });
      expect(refusal(() => generator.generate(request as MonotonicGenerateOptions))).toBe(
        c.expected_error,
      );
    } else {
      expect(refusal(() => generate(request))).toBe(c.expected_error);
    }
  },

  // Sabotage: keeping the current time instead of the last time `T` when the
  // clock moves back in `next` turns m-clock-moves-back and
  // s-overflow-bumps-time red.
  monotonic: (c) => {
    const input = c.input as MonotonicInput;
    const seeds =
      input.overflow_seed === null
        ? [input.initial_seed]
        : [input.initial_seed, input.overflow_seed];
    const { draws, left, overdrawn } = replay(seeds, input.steps);
    const generator = createMonotonic({
      ...(input.prefix !== null && input.prefix !== "" && { prefix: input.prefix }),
      size: input.size,
      compactTime: input.compact,
      draws,
    });
    const ids = input.times.map((time) => generator.generate({ time }));
    expect(ids).toEqual(c.expected);
    expect(left()).toBe(0);
    expect(overdrawn()).toBe(0);
  },
};

describe("the vendored corpus", () => {
  it("is a corpus version this runner knows", () => {
    expect(manifest.corpus_version).toBe(1);
  });

  // Sabotage: flipping one byte of a case file turns this red.
  it("hashes to the manifest's corpus_hash", () => {
    const digest = createHash("sha256");
    for (const entry of manifest.files) digest.update(read(entry.file));
    expect(`sha256:${digest.digest("hex")}`).toBe(manifest.corpus_hash);
  });

  it("has a runner for every kind it lists", () => {
    for (const entry of manifest.files) expect(Object.keys(runners)).toContain(entry.kind);
  });
});

for (const entry of manifest.files) {
  describe(`the corpus's ${entry.kind} cases (${entry.file})`, () => {
    const cases = casesOf(entry);

    it("carries the manifest's case count", () => {
      expect(cases).toHaveLength(entry.case_count);
    });

    const run = runners[entry.kind];
    it.each(cases.map((c) => [c.id, c] as const))("%s", (_id, c) => {
      expect(c.id.startsWith(`${entry.kind}/`)).toBe(true);
      if (run === undefined) throw new Error(`no runner for the kind ${entry.kind}`);
      run(c);
    });
  });
}
