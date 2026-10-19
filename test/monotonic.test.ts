import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMonotonic,
  type GenerateOptions,
  generate,
  type MonotonicDraws,
  type MonotonicGenerateOptions,
  type MonotonicOptions,
  type Size,
  UxidError,
} from "../src/index.js";
import { monotonicCases, monotonicRefusalCases } from "./corpus-subset.js";

interface MonotonicCase {
  readonly id: string;
  readonly input: {
    readonly prefix: string | null;
    readonly size: Size;
    readonly compact: boolean;
    readonly times: readonly number[];
    readonly initial_seed: number;
    readonly steps: readonly number[];
    readonly overflow_seed: number | null;
  };
  readonly expected: readonly string[];
}

interface RefusalInput {
  readonly prefix?: string;
  readonly size?: Size;
  readonly from?: string;
  readonly rand?: string;
  readonly time?: number;
  readonly monotonic: true;
}

const lines = (text: string) =>
  text
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line));

const bytes = (hex: string) =>
  new Uint8Array((hex.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)));

function refusal(run: () => unknown): UxidError {
  try {
    run();
  } catch (error) {
    if (error instanceof UxidError) return error;
    throw error;
  }
  throw new Error("expected a UxidError, and nothing was thrown");
}

/**
 * Draws replayed from lists, as the corpus's runner describes them: every seed
 * comes from `seeds` and every step from `steps`, in order, and each call
 * records the width it was asked for. A draw beyond the end of a list answers
 * 0 for a seed and 1 for a step and is counted in `overdrawn`, so a generator
 * that draws more than the case carries answers a wrong id rather than
 * crashing the test before its assertions run.
 */
function replay(seeds: readonly (number | bigint)[], steps: readonly (number | bigint)[]) {
  const asked: string[] = [];
  const seedQueue = [...seeds];
  const stepQueue = [...steps];
  let overdrawn = 0;
  const draws: MonotonicDraws = {
    seed(width) {
      asked.push(`seed ${width}`);
      const next = seedQueue.shift();
      if (next !== undefined) return next;
      overdrawn++;
      return 0;
    },
    step(width) {
      asked.push(`step ${width}`);
      const next = stepQueue.shift();
      if (next !== undefined) return next;
      overdrawn++;
      return 1;
    },
  };
  return {
    draws,
    asked,
    seedsLeft: () => seedQueue.length,
    stepsLeft: () => stepQueue.length,
    overdrawn: () => overdrawn,
  };
}

/** The id `run` answers, or `refused: <code>` when it throws a UxidError. */
function attempt(run: () => string): string {
  try {
    return run();
  } catch (error) {
    if (error instanceof UxidError) return `refused: ${error.code}`;
    throw error;
  }
}

const T = 1700000000000;

/** A value as the bytes of a random field `width` bytes wide, big-endian. */
function field(value: number | bigint, width: number): Uint8Array {
  const out = new Uint8Array(width);
  let rest = BigInt(value);
  for (let i = width - 1; i >= 0; i--) {
    out[i] = Number(rest % 256n);
    rest /= 256n;
  }
  return out;
}

/**
 * The id `generate` builds with the random field fixed to `value`: what a
 * monotonic generator must answer when it chose that value at that time.
 */
function idOf(options: GenerateOptions, value: number | bigint, width: number): string {
  return generate({ ...options, rand: field(value, width) });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the corpus's monotonic cases", () => {
  const cases = lines(monotonicCases) as MonotonicCase[];

  it("carries every line of the case file", () => {
    expect(cases).toHaveLength(6);
  });

  // Sabotage: keeping the current time instead of the last time `T` when the
  // clock moves back in `next` turns m-clock-moves-back and
  // s-overflow-bumps-time red.
  it.each(cases.map((c) => [c.id, c] as const))("%s", (_id, c) => {
    const seeds =
      c.input.overflow_seed === null
        ? [c.input.initial_seed]
        : [c.input.initial_seed, c.input.overflow_seed];
    const { draws, seedsLeft, stepsLeft, overdrawn } = replay(seeds, c.input.steps);
    const generator = createMonotonic({
      ...(c.input.prefix !== null && { prefix: c.input.prefix }),
      size: c.input.size,
      compactTime: c.input.compact,
      draws,
    });
    const ids = c.input.times.map((time) => generator.generate({ time }));
    expect(ids).toEqual(c.expected);
    expect(seedsLeft()).toBe(0);
    expect(stepsLeft()).toBe(0);
    expect(overdrawn()).toBe(0);
  });
});

describe("the corpus's monotonic refusals", () => {
  const cases = lines(monotonicRefusalCases) as {
    id: string;
    input: { generate: RefusalInput };
    expected_error: string;
  }[];

  // Sabotage: deleting the `from` check or the `rand` check in
  // `refuseConflicts` turns its case red.
  it.each(cases.map((c) => [c.id, c] as const))("%s", (_id, c) => {
    const { monotonic: _monotonic, rand, ...rest } = c.input.generate;
    const options: MonotonicGenerateOptions = {
      ...rest,
      ...(rand !== undefined && { rand: bytes(rand) }),
    };
    // Draws enough for one id, so a generator that let the request through
    // would answer an id rather than fail for want of a draw.
    const generator = createMonotonic({ draws: replay([0], []).draws });
    expect(refusal(() => generator.generate(options)).code).toBe(c.expected_error);
  });
});

describe("createMonotonic", () => {
  // Sabotage: dropping the `+ 1` that moves the time forward on an overflow in
  // `next`, or comparing with `<=` instead of `<` against 2^(8w) there, turns
  // this red: 0xfffe + 2 is exactly 2^16.
  it("moves to the next millisecond with a fresh value when a step overflows", () => {
    const { draws, asked } = replay([0xfffe, 0x0102], [2]);
    const generator = createMonotonic({ prefix: "usr", size: "s", draws });
    const first = generator.generate({ time: T });
    const second = generator.generate({ time: T });
    expect(first).toBe(idOf({ prefix: "usr", size: "s", time: T }, 0xfffe, 2));
    expect(second).toBe(idOf({ prefix: "usr", size: "s", time: T + 1 }, 0x0102, 2));
    expect(asked).toEqual(["seed 2", "step 2", "seed 2"]);
    expect(second > first).toBe(true);
  });

  // Sabotage: comparing against 2^(8w) - 1 instead of 2^(8w) in `next` turns
  // this red: the last value the field holds is kept, not overflowed.
  it("keeps the millisecond while the stepped value still fits the field", () => {
    const { draws } = replay([0xfffe], [1]);
    const generator = createMonotonic({ prefix: "usr", size: "s", draws });
    generator.generate({ time: T });
    expect(generator.generate({ time: T })).toBe("usr_01hf7yat00zzz1");
  });

  // Sabotage: drawing a fresh value whenever the time differs from `T`
  // (`!==` instead of `>`) in `next` turns this red.
  it("draws a fresh value when the time moves forward, and steps when it moves back", () => {
    const { draws, asked } = replay([5, 9], [3, 4]);
    const generator = createMonotonic({ size: "s", draws });
    generator.generate({ time: T });
    generator.generate({ time: T - 5 });
    const later = generator.generate({ time: T + 7 });
    const back = generator.generate({ time: T });
    expect(asked).toEqual(["seed 2", "step 2", "seed 2", "step 2"]);
    expect(later).toBe(idOf({ size: "s", time: T + 7 }, 9, 2));
    expect(back).toBe(idOf({ size: "s", time: T + 7 }, 13, 2));
  });

  // Sabotage: keying the state by prefix alone in `createMonotonic` turns
  // this red.
  it("keeps one state per prefix and random width", () => {
    const { draws, asked } = replay([1, 2, 3], [4]);
    const generator = createMonotonic({ size: "s", draws });
    generator.generate({ prefix: "usr", time: T });
    generator.generate({ prefix: "cus", time: T });
    generator.generate({ prefix: "usr", time: T, randSize: 3 });
    const stepped = generator.generate({ prefix: "usr", time: T });
    expect(asked).toEqual(["seed 2", "seed 2", "seed 3", "step 2"]);
    expect(stepped).toBe(idOf({ prefix: "usr", size: "s", time: T }, 5, 2));
  });

  // Sabotage: moving the state map to module level in src/monotonic.ts turns
  // this red.
  it("keeps its state in the generator, so two generators never share it", () => {
    // The second generator could step if it saw the first one's state, so a
    // shared state shows up as a different id rather than a missing draw.
    const one = createMonotonic({ size: "s", draws: replay([7], []).draws });
    const two = createMonotonic({ size: "s", draws: replay([7], [1]).draws });
    const a = one.generate({ time: T });
    const b = two.generate({ time: T });
    expect(a).toBe(b);
    expect(b).toBe(idOf({ size: "s", time: T }, 7, 2));
  });

  // Sabotage: preferring the generator's option over the call's in `pick`
  // turns this red.
  it("takes each option from the call, else from the generator", () => {
    const generator = createMonotonic({
      prefix: "usr",
      size: "s",
      case: "upper",
      delimiter: "-",
      draws: replay([0xabcd, 0xabcd], []).draws,
    });
    expect(generator.generate({ time: T })).toBe(
      idOf({ prefix: "usr", size: "s", case: "upper", delimiter: "-", time: T }, 0xabcd, 2),
    );
    expect(generator.generate({ prefix: "cus", case: "lower", delimiter: "_", time: T })).toBe(
      idOf({ prefix: "cus", size: "s", time: T }, 0xabcd, 2),
    );
  });

  // Sabotage: defaulting the time to 0 instead of the current time in
  // `readTime` turns this red.
  it("defaults to the current time and takes a Date", () => {
    vi.spyOn(Date, "now").mockReturnValue(T);
    const generator = createMonotonic({ size: "s", draws: replay([1], []).draws });
    expect(generator.generate()).toBe(idOf({ size: "s", time: T }, 1, 2));
    const fromDate = createMonotonic({ size: "s", draws: replay([1], []).draws });
    expect(fromDate.generate({ time: new Date(T + 1) })).toBe(
      idOf({ size: "s", time: T + 1 }, 1, 2),
    );
  });

  // Sabotage: defaulting compact time to false at xs in `resolveStream`
  // turns this red.
  it("uses compact time for xs, so a monotonic xs has a field to step", () => {
    const { draws, asked } = replay([3], [2]);
    const ids = attempt(() => {
      const generator = createMonotonic({ prefix: "usr", size: "xs", draws });
      return `${generator.generate({ time: T })} ${generator.generate({ time: T })}`;
    });
    expect(ids).toBe("usr_hf7yat0003 usr_hf7yat0005");
    expect(asked).toEqual(["seed 1", "step 1"]);
  });

  // Sabotage: deleting the xs check in `resolveStream` turns the first and
  // last expectations red; deleting the zero-width check turns the second
  // red.
  it("refuses a monotonic xs with standard time and a random field of no bytes", () => {
    // Draws enough for one id, so a request let through answers an id.
    const generator = createMonotonic({ draws: replay([0], []).draws });
    const xs = refusal(() => generator.generate({ size: "xs", compactTime: false }));
    expect(xs.code).toBe("invalid_option");
    expect(xs.message).toContain("compactTime");
    const empty = refusal(() => generator.generate({ size: "m", randSize: 0 }));
    expect(empty.code).toBe("invalid_option");
    expect(empty.message).toContain("randSize");
    const atCreation = refusal(() =>
      createMonotonic({ size: "xs", compactTime: false, draws: replay([], []).draws }),
    );
    expect(atCreation.code).toBe("invalid_option");
  });

  // Sabotage: skipping `refuseConflicts` on the options of `createMonotonic`
  // turns this red.
  it("refuses from and rand given to the generator itself", () => {
    const withFrom = { from: "alice@example.com" } as unknown as MonotonicOptions;
    const withRand = { rand: new Uint8Array(10) } as unknown as MonotonicOptions;
    expect(refusal(() => createMonotonic(withFrom)).code).toBe("from_with_monotonic");
    expect(refusal(() => createMonotonic(withRand)).code).toBe("rand_with_monotonic");
  });

  // Sabotage: moving `state.set` above the encoding in `generate` turns this
  // red: the refused call would leave its value behind and the next call
  // would step from it.
  it("leaves its state unchanged when a call is refused", () => {
    const { draws } = replay([1, 0xffffff], [1]);
    const generator = createMonotonic({ size: "s", compactTime: true, draws });
    generator.generate({ time: T });
    const atGuard = 2164663517184;
    expect(refusal(() => generator.generate({ time: atGuard })).code).toBe(
      "compact_time_out_of_range",
    );
    let after = "";
    expect(() => {
      after = generator.generate({ time: T });
    }).not.toThrow();
    expect(after).toBe(idOf({ size: "s", compactTime: true, time: T }, 2, 3));
  });

  // Sabotage: deleting the MAX_TIME check in `next` turns this red.
  it("refuses to move past the last millisecond a time body holds", () => {
    const max = 2 ** 48 - 1;
    const generator = createMonotonic({ size: "s", draws: replay([0xffff], [1]).draws });
    expect(generator.generate({ time: max })).toBe("7zzzzzzzzzzzz1");
    const error = refusal(() => generator.generate({ time: max }));
    expect(error.code).toBe("invalid_option");
    expect(error.message).toContain("2^48 - 1");
  });

  // Sabotage: dropping the range check in `checkedDraw` turns the range cases
  // red; flooring a fractional number there turns the fractional case red;
  // reading a numeric string there turns the string case red.
  it.each([
    ["a seed of 2^16", [0x10000], []],
    ["a negative seed", [-1], []],
    ["a fractional seed", [1.5], []],
    ["a seed that is not a number", ["1"], []],
    ["a step of 0", [1], [0]],
    ["a step of 2^8 + 1", [1], [257]],
    ["a bigint step of 2^53", [1], [2n ** 53n]],
  ] as const)("refuses %s for a 2-byte field, naming draws", (_label, seeds, steps) => {
    const { draws } = replay(seeds as unknown as number[], steps);
    const generator = createMonotonic({ size: "s", draws });
    const error = refusal(() => {
      generator.generate({ time: T });
      generator.generate({ time: T });
    });
    expect(error.code).toBe("invalid_option");
    expect(error.message).toContain("draws");
  });

  // Sabotage: reading each draw through `Number` in `checkedDraw` turns this
  // red: an 80-bit value loses its low bits.
  it("steps an 80-bit field exactly, with the draws as bigints", () => {
    const top = 2n ** 80n - 2n ** 40n - 1n;
    const generator = createMonotonic({ size: "xl", draws: replay([top], [2n ** 40n]).draws });
    generator.generate({ time: T });
    expect(generator.generate({ time: T })).toBe(idOf({ size: "xl", time: T }, 2n ** 80n - 1n, 10));
  });

  // Sabotage: deleting the shape check on `draws` or on `byteSource` in
  // `readDraws` turns its expectation red.
  it("refuses draws and a byteSource of the wrong shape", () => {
    const badDraws = { seed: () => 1 } as unknown as MonotonicDraws;
    expect(refusal(() => createMonotonic({ draws: badDraws })).message).toContain("draws");
    const nullDraws = null as unknown as MonotonicDraws;
    expect(refusal(() => createMonotonic({ draws: nullDraws })).message).toContain("draws");
    const badSource = 7 as unknown as (count: number) => Uint8Array;
    expect(refusal(() => createMonotonic({ byteSource: badSource })).message).toContain(
      "byteSource",
    );
  });

  // Sabotage: deleting the eager `resolveStream` call in `createMonotonic`
  // turns this red.
  it("checks the generator's own options when it is created", () => {
    const badSize = "huge" as unknown as Size;
    expect(refusal(() => createMonotonic({ size: badSize })).code).toBe("invalid_option");
  });
});

describe("the default draws", () => {
  // Sabotage: reading the seed's bytes little-endian in `bigEndian` turns
  // this red.
  it("reads a fresh value as the field's bytes, big-endian", () => {
    const calls: number[] = [];
    const generator = createMonotonic({
      size: "s",
      byteSource: (count) => {
        calls.push(count);
        return Uint8Array.from({ length: count }, (_, i) => i + 1);
      },
    });
    expect(generator.generate({ time: T })).toBe(idOf({ size: "s", time: T }, 0x0102, 2));
    expect(calls).toEqual([2]);
  });

  // The seed's bytes are all zero and the step's all `fill`, so the second
  // id's random value is the step itself.
  // Sabotage: dropping the mask in the default `step` turns the odd-width
  // 0xff cases red (an even width draws whole bytes, which the mask keeps
  // whole); dropping its `+ 1n` turns every 0xff case red.
  it.each([
    [1, 0xff, 16],
    [1, 0x00, 1],
    [2, 0xff, 256],
    [2, 0x00, 1],
    [3, 0xff, 4096],
    [5, 0xff, 2 ** 20],
    [10, 0xff, 2 ** 40],
  ])(
    "draws a step for a %i-byte field from masked bytes (fill %i, step %i)",
    (width, fill, step) => {
      const calls: number[] = [];
      const byteSource = (count: number) => {
        calls.push(count);
        return new Uint8Array(count).fill(calls.length === 1 ? 0 : fill);
      };
      const generator = createMonotonic({ size: "m", randSize: width, byteSource });
      const request = { size: "m", randSize: width, time: T } as const;
      expect(attempt(() => generator.generate({ time: T }))).toBe(idOf(request, 0, width));
      expect(attempt(() => generator.generate({ time: T }))).toBe(idOf(request, step, width));
      expect(calls).toEqual([width, Math.ceil(width / 2)]);
    },
  );

  // Sabotage: drawing from `platformByteSource` with a zero-filled array in
  // place of `getRandomValues` turns this red.
  it("defaults to the platform's crypto.getRandomValues", () => {
    const getRandomValues = vi.fn((array: Uint8Array) => array.fill(0x11));
    vi.stubGlobal("crypto", { getRandomValues });
    const generator = createMonotonic({ size: "s" });
    expect(generator.generate({ time: T })).toBe(idOf({ size: "s", time: T }, 0x1111, 2));
    expect(getRandomValues).toHaveBeenCalledTimes(1);
  });

  // Sabotage: drawing a byte when `readDraws` builds the default draws, rather
  // than at the first id, turns the creation red.
  it("fails naming byteSource when the platform has no CSPRNG, and only when it draws", () => {
    vi.stubGlobal("crypto", undefined);
    let generator = createMonotonic({ draws: replay([], []).draws });
    expect(() => {
      generator = createMonotonic({ size: "s" });
    }).not.toThrow();
    const error = refusal(() => generator.generate({ time: T }));
    expect(error.code).toBe("byte_source_unavailable");
    expect(error.message).toContain("byteSource");
  });

  // Draws from the platform's CSPRNG: whatever the values, every id in one
  // millisecond sorts after the one before it.
  // Sabotage: subtracting the step instead of adding it in `next` turns this
  // red.
  it("keeps ids in one millisecond strictly increasing", () => {
    for (const size of ["xs", "s", "m", "l", "xl"] as const) {
      const ids: string[] = [];
      const outcome = attempt(() => {
        const generator = createMonotonic({ prefix: "usr", size });
        for (let i = 0; i < 200; i++) ids.push(generator.generate({ time: T }));
        return "done";
      });
      expect(outcome, size).toBe("done");
      const outOfOrder = ids.findIndex((id, i) => i > 0 && id <= (ids[i - 1] as string));
      expect(outOfOrder, `${size}: the first id not after the one before it`).toBe(-1);
    }
  });
});
