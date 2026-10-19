import { afterEach, describe, expect, it, vi } from "vitest";
import { type GenerateOptions, generate, type Size, UxidError } from "../src/index.js";
import { encodeCases, generateRefusalCases } from "./corpus-subset.js";

interface CaseOptions {
  readonly prefix?: string | null;
  readonly size?: Size;
  readonly compact?: boolean;
  readonly case?: "lower" | "upper";
  readonly time?: number;
  readonly rand?: string;
  readonly rand_size?: number;
}

const lines = (text: string) =>
  text
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line));

const bytes = (hex: string) =>
  new Uint8Array((hex.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)));

// The corpus spells options as the Elixir package does; this maps them onto
// this package's names. A null prefix is no prefix.
function options(input: CaseOptions): GenerateOptions {
  return {
    ...(input.prefix != null && { prefix: input.prefix }),
    ...(input.size !== undefined && { size: input.size }),
    ...(input.compact !== undefined && { compactTime: input.compact }),
    ...(input.case !== undefined && { case: input.case }),
    ...(input.time !== undefined && { time: input.time }),
    ...(input.rand !== undefined && { rand: bytes(input.rand) }),
    ...(input.rand_size !== undefined && { randSize: input.rand_size }),
  };
}

function refusal(run: () => unknown): UxidError {
  try {
    run();
  } catch (error) {
    if (error instanceof UxidError) return error;
    throw error;
  }
  throw new Error("expected a UxidError, and nothing was thrown");
}

const T = 1700000000000;
// Bytes 1, 2, 3, ... so an expected random field can be worked out by hand.
const counting: (count: number) => Uint8Array = (count) =>
  Uint8Array.from({ length: count }, (_, i) => i + 1);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the corpus's encode cases", () => {
  const cases = lines(encodeCases) as { id: string; input: CaseOptions; expected: string }[];

  it("carries the subset it was copied with", () => {
    expect(cases).toHaveLength(20);
  });

  // Sabotage: making the last short group in `encodeBytes` shift left (as RFC
  // 4648 pads) turns the rand-all-ones and partial-width cases red.
  it.each(cases.map((c) => [c.id, c] as const))("%s", (_id, c) => {
    expect(generate(options(c.input))).toBe(c.expected);
  });
});

describe("the corpus's generation refusals", () => {
  const cases = lines(generateRefusalCases) as {
    id: string;
    input: { generate: CaseOptions };
    expected_error: string;
  }[];

  // Sabotage: deleting the marker guard in `encodeTime`, the width check in
  // `fixed` or the cap check in `readWidth` turns its cases red.
  it.each(cases.map((c) => [c.id, c] as const))("%s", (_id, c) => {
    expect(refusal(() => generate(options(c.input.generate))).code).toBe(c.expected_error);
  });
});

describe("generate", () => {
  // Sabotage: mapping `xlarge` to `l` in the size table turns this red.
  it("reads each long size spelling as its short one", () => {
    const pairs: [Size, Size][] = [
      ["xsmall", "xs"],
      ["small", "s"],
      ["medium", "m"],
      ["large", "l"],
      ["xlarge", "xl"],
    ];
    for (const [long, short] of pairs) {
      for (const compactTime of [false, true]) {
        const base = { time: T, compactTime, byteSource: counting };
        expect(generate({ ...base, size: long })).toBe(generate({ ...base, size: short }));
      }
    }
  });

  // Sabotage: defaulting the size to `l` in `readSize` turns this red.
  it("defaults to xl, standard time, lower case, no prefix and the current time", () => {
    const before = generate({ size: "xs", time: Date.now() });
    const id = generate({ byteSource: counting });
    const after = generate({ size: "xs", time: Date.now() });
    expect(id).toMatch(/^[0-7][0-9a-hjkmnp-tv-z]{25}$/);
    expect(id.slice(10)).toBe("041061050r3gg28a");
    expect(id.slice(0, 10) >= before && id.slice(0, 10) <= after).toBe(true);
  });

  // Sabotage: dropping `randSize` in favor of the size's width in `readWidth`
  // turns this red.
  it("lets randSize override the size's random width", () => {
    const id = generate({ size: "s", randSize: 4, time: T, byteSource: counting });
    expect(id).toBe("01hf7yat000410610");
    expect(generate({ size: "xl", randSize: 0, time: T })).toBe("01hf7yat00");
  });

  // Sabotage: replacing `delimiter` with "_" in the return of `generate` turns
  // this red.
  it("writes the delimiter between the prefix and the body, and none without a prefix", () => {
    const base = { size: "xs", time: T } as const;
    expect(generate({ ...base, prefix: "usr", delimiter: "-" })).toBe("usr-01hf7yat00");
    expect(generate({ ...base, prefix: "usr", delimiter: "::" })).toBe("usr::01hf7yat00");
    expect(generate({ ...base, prefix: "", delimiter: "-" })).toBe("01hf7yat00");
  });

  // Sabotage: upper-casing the whole id instead of the body turns this red.
  it("applies the case to the body and never to the prefix", () => {
    expect(generate({ prefix: "Usr", size: "xs", time: T, case: "upper" })).toBe("Usr_01HF7YAT00");
  });

  // Sabotage: reading a Date with `getTimezoneOffset` added in `readTime`
  // turns this red.
  it("takes the time as a Date as well as a number", () => {
    expect(generate({ size: "xs", time: new Date(T) })).toBe(generate({ size: "xs", time: T }));
  });

  // Sabotage: dropping the `% COMPACT_WINDOW` in `encodeTime` turns this red.
  it("writes the low 40 bits of the time under compact time", () => {
    const base = { size: "xs", compactTime: true, rand: bytes("01") } as const;
    expect(generate({ ...base, time: 2 ** 40 + T })).toBe(generate({ ...base, time: T }));
    const guard = 2 ** 40 + 31 * 2 ** 35;
    expect(refusal(() => generate({ ...base, time: guard })).code).toBe(
      "compact_time_out_of_range",
    );
  });

  // Sabotage: drawing from `platformByteSource` when a byteSource is passed
  // turns this red.
  it("draws the random field from the byteSource, once, for the field's width", () => {
    const source = vi.fn(counting);
    expect(generate({ size: "m", time: T, byteSource: source })).toBe("01hf7yat0004106105");
    expect(source).toHaveBeenCalledTimes(1);
    expect(source).toHaveBeenCalledWith(5);
  });

  // Sabotage: calling the byteSource before the `width === 0` return in
  // `draw` turns this red.
  it("never calls the byteSource for an empty or a fixed random field", () => {
    const source = vi.fn(counting);
    generate({ size: "xs", time: T, byteSource: source });
    generate({ size: "s", time: T, rand: bytes("0123"), byteSource: source });
    expect(source).not.toHaveBeenCalled();
  });

  // Sabotage: returning a zero-filled array from `platformByteSource` turns
  // this red.
  it("defaults to the platform's crypto.getRandomValues", () => {
    const spy = vi.spyOn(globalThis.crypto, "getRandomValues");
    const random = vi.spyOn(Math, "random");
    const ids = new Set(Array.from({ length: 8 }, () => generate({ time: T })));
    expect(ids.size).toBe(8);
    expect(spy).toHaveBeenCalledTimes(8);
    expect(random).not.toHaveBeenCalled();
  });

  // Sabotage: falling back to a zero-filled array in `platformByteSource`
  // when crypto is absent turns this red.
  it("fails with a UxidError naming byteSource when the platform has no CSPRNG", () => {
    vi.stubGlobal("crypto", undefined);
    const error = refusal(() => generate({ time: T }));
    expect(error.code).toBe("byte_source_unavailable");
    expect(error.message).toContain("byteSource");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("UxidError");
    vi.stubGlobal("crypto", {});
    expect(refusal(() => generate({ time: T })).code).toBe("byte_source_unavailable");
    expect(generate({ size: "s", time: T, byteSource: counting })).toBe("01hf7yat000410");
  });

  // Sabotage: removing the length check on the byteSource's answer in `draw`
  // turns this red.
  it("refuses a byteSource that answers the wrong bytes", () => {
    const short = refusal(() => generate({ time: T, byteSource: () => new Uint8Array(3) }));
    expect(short.code).toBe("invalid_option");
    expect(short.message).toContain("byteSource");
    const wrongType = () => [1, 2] as unknown as Uint8Array;
    expect(refusal(() => generate({ time: T, byteSource: wrongType })).code).toBe("invalid_option");
  });

  // Sabotage: accepting any string in `readSize` turns this red.
  it("refuses options of the wrong type or outside their range, naming the option", () => {
    const bad: [string, Record<string, unknown>][] = [
      ["size", { size: "huge" }],
      ["size", { size: "toString" }],
      ["size", { size: 3 }],
      ["case", { case: "title" }],
      ["delimiter", { delimiter: "" }],
      ["prefix", { prefix: 7 }],
      ["compactTime", { compactTime: "yes" }],
      ["time", { time: -1 }],
      ["time", { time: 2 ** 48 }],
      ["time", { time: 1.5 }],
      ["time", { time: new Date(Number.NaN) }],
      ["time", { time: "now" }],
      ["randSize", { randSize: -1 }],
      ["randSize", { randSize: 2.5 }],
      ["rand", { rand: [1, 2] }],
      ["byteSource", { byteSource: "crypto" }],
    ];
    for (const [option, given] of bad) {
      const error = refusal(() => generate({ time: T, ...given } as GenerateOptions));
      expect(error.code, option).toBe("invalid_option");
      expect(error.message.startsWith(`${option} must be`), error.message).toBe(true);
    }
  });

  // Sabotage: comparing against 32 instead of 31 in the marker guard of
  // `encodeTime` turns this red.
  it("refuses compact time only from the marker's first millisecond", () => {
    const guard = 31 * 2 ** 35;
    const base = { size: "s", compactTime: true, rand: bytes("010203") } as const;
    expect(generate({ ...base, time: guard - 1 })).toBe("yzzzzzzz04103");
    expect(refusal(() => generate({ ...base, time: guard })).code).toBe(
      "compact_time_out_of_range",
    );
    expect(generate({ size: "s", time: guard, rand: bytes("0102") })).toMatch(/^00z0000000/);
  });
});
