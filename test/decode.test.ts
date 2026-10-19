import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type DecodeResult,
  decode,
  generate,
  isDeterministic,
  isValid,
  UxidError,
} from "../src/index.js";

// A decoder clock inside the window the corpus README names for its compact
// cases: from 1699913600000 inclusive to 2164577117183 exclusive.
const CLOCK = 1_700_000_000_000;
const WINDOW = 2 ** 40;
const DAY = 86_400_000;

function refusal(run: () => unknown): UxidError {
  try {
    run();
  } catch (error) {
    if (error instanceof UxidError) return error;
    throw error;
  }
  throw new Error("expected a UxidError, and nothing was thrown");
}

function timeOf(result: DecodeResult): number | null {
  if (!result.ok) throw new Error(`expected a value, got the refusal ${result.error}`);
  return result.value.time;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("decode", () => {
  // Sabotage: answering a compact reading for the lengths 10 and 18 in the
  // length table turns this red.
  it("reads the lengths 10 and 18 as standard time, so compact xs and m lose their time", () => {
    for (const size of ["xs", "m"] as const) {
      const id = generate({
        prefix: "usr",
        size,
        compactTime: true,
        time: CLOCK,
        rand: compactRand(size),
      });
      const result = decode(id, { now: CLOCK });
      expect(result.ok && result.value.size).toBe(size);
      expect(result.ok && result.value.compact).toBe(false);
      expect(timeOf(result)).not.toBe(CLOCK);
      expect(timeOf(result)).toBe(timeOf(decode(`usr_${id.slice(4, 14)}`)));
    }
  });

  // Sabotage: reading the time from the second body character in
  // `standardTime` turns this red.
  it("reads back the time and size of every standard id it is given", () => {
    for (const size of ["xs", "s", "m", "l", "xl"] as const) {
      for (const time of [0, 1, CLOCK, 2 ** 48 - 1]) {
        for (const letterCase of ["lower", "upper"] as const) {
          const id = generate({ prefix: "cus", size, time, case: letterCase, rand: rand(size) });
          expect(decode(id)).toEqual({
            ok: true,
            value: { prefix: "cus", size, compact: false, deterministic: false, time },
          });
        }
      }
    }
  });

  // Sabotage: taking the compact time's high bits from the body instead of
  // the clock in `compactTime` turns this red.
  it("reads back the time of every compact s, l and xl id within the clock's window", () => {
    for (const size of ["s", "l", "xl"] as const) {
      for (const time of [CLOCK - 5 * DAY, CLOCK, CLOCK + DAY]) {
        const id = generate({ size, time, compactTime: true, rand: compactRand(size) });
        expect(decode(id, { now: CLOCK })).toEqual({
          ok: true,
          value: { prefix: null, size, compact: true, deterministic: false, time },
        });
      }
    }
  });

  // Sabotage: changing `>` to `>=` in the one-day comparison of `compactTime`
  // turns this red.
  it("subtracts one window only when the result is more than one day ahead of the clock", () => {
    const at = (time: number) =>
      generate({ size: "s", compactTime: true, time, rand: compactRand("s") });
    expect(timeOf(decode(at(CLOCK + DAY), { now: CLOCK }))).toBe(CLOCK + DAY);
    expect(timeOf(decode(at(CLOCK + DAY + 1), { now: CLOCK }))).toBe(CLOCK + DAY + 1 - WINDOW);
  });

  // Sabotage: adding the window instead of subtracting it in `compactTime`
  // turns this red.
  it("recovers an id from the window before the clock's", () => {
    const now = 3 * WINDOW + 1000;
    const time = 3 * WINDOW - 2 ** 36;
    const id = generate({ size: "xl", compactTime: true, time, rand: compactRand("xl") });
    expect(timeOf(decode(id, { now }))).toBe(time);
  });

  // Sabotage: reading a Date clock as 0 in `readNow` turns this red.
  it("takes the clock as a Date", () => {
    const now = 3 * WINDOW + (CLOCK % WINDOW);
    expect(timeOf(decode("usr_hf7yat0004hm5", { now: new Date(now) }))).toBe(now);
  });

  // Sabotage: reading the clock before the refusal checks in `decode` turns
  // the count red.
  it("reads the current time by default, and only for a compact body", () => {
    const now = 3 * WINDOW + (CLOCK % WINDOW);
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    expect(timeOf(decode("usr_01hf7yat0004h1"))).toBe(CLOCK);
    expect(decode("usr_")).toEqual({ ok: false, error: "empty" });
    expect(clock).not.toHaveBeenCalled();
    expect(timeOf(decode("usr_hf7yat0004hm5"))).toBe(now);
    expect(clock).toHaveBeenCalledTimes(1);
  });

  // Sabotage: answering a time for a marker body in `decode` turns this red.
  it("reports a marker body as deterministic with no time, at any table length", () => {
    expect(decode("zzzzzzzzzz")).toEqual({
      ok: true,
      value: { prefix: null, size: "xs", compact: false, deterministic: true, time: null },
    });
    expect(decode(`Z${"0".repeat(23)}`)).toEqual({
      ok: true,
      value: { prefix: null, size: "xl", compact: true, deterministic: true, time: null },
    });
  });

  // Sabotage: keeping only the text before the first delimiter as the prefix
  // in `split` turns this red.
  it("takes the body after the last delimiter, and an empty prefix before a leading one", () => {
    const body = "01hf7yat0004h1";
    const prefixOf = (id: string, delimiter?: string) => {
      const result = decode(id, delimiter === undefined ? {} : { delimiter });
      return result.ok ? result.value.prefix : result.error;
    };
    expect(prefixOf(`a_b_c_${body}`)).toBe("a_b_c");
    expect(prefixOf(`_${body}`)).toBe("");
    expect(prefixOf(body)).toBeNull();
    expect(prefixOf(`usr--${body}`, "--")).toBe("usr");
    expect(prefixOf(`usr_${body}`, "--")).toBe("invalid_character");
    expect(prefixOf(`a.b.${body}`, ".")).toBe("a.b");
  });

  // Sabotage: checking the characters before the length in `refuse` turns
  // the second line red.
  it("refuses in the order empty, invalid_length, invalid_character", () => {
    expect(decode("usr_")).toEqual({ ok: false, error: "empty" });
    expect(decode("usr_01hf7yat00!")).toEqual({ ok: false, error: "invalid_length" });
    expect(decode("usr_01hf7yat0!!!!")).toEqual({ ok: false, error: "invalid_character" });
  });

  // Sabotage: accepting Crockford's reading substitutions (I and L as 1, O as
  // 0) in the symbol table turns this red.
  it("refuses every character outside the alphabet, in either case", () => {
    const base = "01hf7yat0004h1";
    for (const bad of ["i", "I", "l", "L", "o", "O", "u", "U", "-", " ", "\u0000", "\u007f"]) {
      const id = `${base.slice(0, 13)}${bad}`;
      expect(decode(id)).toEqual({ ok: false, error: "invalid_character" });
    }
  });

  // Sabotage: counting a surrogate pair as two 3-byte characters in
  // `utf8Length` turns this red.
  it("counts the body's length in UTF-8 bytes", () => {
    const thirteen = "01hf7yat0004h";
    const twoBytes = String.fromCodePoint(0xe9);
    const threeBytes = String.fromCodePoint(0x20ac);
    const fourBytes = String.fromCodePoint(0x1f600);
    // One more byte than 13: a 1-byte character makes 14, a table length.
    expect(decode(`${thirteen}!`)).toEqual({ ok: false, error: "invalid_character" });
    // 12 ASCII characters and a 2-byte one: 14 bytes.
    expect(decode(`${thirteen.slice(0, 12)}${twoBytes}`)).toEqual({
      ok: false,
      error: "invalid_character",
    });
    // 11 ASCII characters and a 3-byte one: 14 bytes.
    expect(decode(`${thirteen.slice(0, 11)}${threeBytes}`)).toEqual({
      ok: false,
      error: "invalid_character",
    });
    // 10 ASCII characters and one written as a surrogate pair: 14 bytes.
    expect(decode(`${thirteen.slice(0, 10)}${fourBytes}`)).toEqual({
      ok: false,
      error: "invalid_character",
    });
    // 11 ASCII characters and a lone surrogate, written as 3 bytes: 14 bytes.
    expect(decode(`${thirteen.slice(0, 11)}\ud83d`)).toEqual({
      ok: false,
      error: "invalid_character",
    });
    expect(decode(`${thirteen.slice(0, 11)}\ude00`)).toEqual({
      ok: false,
      error: "invalid_character",
    });
    // 12 ASCII characters and one written as a surrogate pair: 16 bytes, not
    // a table length.
    expect(decode(`${thirteen.slice(0, 12)}${fourBytes}`)).toEqual({
      ok: false,
      error: "invalid_length",
    });
  });

  // Sabotage: refusing a value that is not a string as `empty` in `decode`
  // turns this red.
  it("refuses a value that is not a string, without throwing", () => {
    for (const value of [
      undefined,
      null,
      42,
      {},
      ["usr_01hf7yat0004h1"],
      new String("01hf7yat0004h1"),
    ]) {
      expect(decode(value)).toEqual({ ok: false, error: "invalid_character" });
    }
  });

  // Sabotage: deleting the range check in `readNow` turns the `-1` and
  // `2 ** 48` lines red.
  it("throws invalid_option for an option of the wrong type or outside its range", () => {
    expect(refusal(() => decode("usr_01hf7yat0004h1", { delimiter: "" })).code).toBe(
      "invalid_option",
    );
    expect(
      refusal(() => decode("usr_01hf7yat0004h1", { delimiter: 1 as never })).message,
    ).toContain("delimiter");
    expect(refusal(() => decode("usr_01hf7yat0004h1", { now: -1 })).message).toContain("now");
    expect(refusal(() => decode("usr_01hf7yat0004h1", { now: 1.5 })).code).toBe("invalid_option");
    expect(refusal(() => decode("usr_01hf7yat0004h1", { now: 2 ** 48 })).code).toBe(
      "invalid_option",
    );
    expect(refusal(() => decode("usr_01hf7yat0004h1", { now: new Date(Number.NaN) })).code).toBe(
      "invalid_option",
    );
  });
});

describe("isValid", () => {
  // Sabotage: answering true for any refusal in `isValid` turns this red.
  it("is true exactly when decode answers a value", () => {
    expect(isValid("usr_01hf7yat0004h1")).toBe(true);
    expect(isValid("01HF7YAT0004H1")).toBe(true);
    expect(isValid("usr_zcvt7epac0t1ebcsjfyf7cwz25")).toBe(true);
    for (const value of ["", "usr_", "usr_01hf7yat0004", "usr_01hf7yat0004hl", 42, null]) {
      expect(isValid(value)).toBe(false);
    }
  });

  // Sabotage: comparing the expected prefix case-insensitively in `isValid`
  // turns this red.
  it("requires the prefix it is given, exactly, and accepts any for none or an empty one", () => {
    const id = "cus_01hf7yat0004h1";
    expect(isValid(id, { prefix: "cus" })).toBe(true);
    expect(isValid(id, { prefix: "usr" })).toBe(false);
    expect(isValid(id, { prefix: "CUS" })).toBe(false);
    expect(isValid(id, { prefix: "" })).toBe(true);
    expect(isValid("01hf7yat0004h1", { prefix: "cus" })).toBe(false);
    expect(isValid("01hf7yat0004h1", { prefix: "" })).toBe(true);
    expect(isValid("a_b_01hf7yat0004h1", { prefix: "a_b" })).toBe(true);
    expect(isValid("cus.01hf7yat0004h1", { prefix: "cus", delimiter: "." })).toBe(true);
  });

  // Sabotage: skipping the prefix check in `readPrefix` turns this red.
  it("throws invalid_option for a prefix that is not a string", () => {
    expect(refusal(() => isValid("cus_01hf7yat0004h1", { prefix: 1 as never })).message).toContain(
      "prefix",
    );
  });
});

describe("isDeterministic", () => {
  // Sabotage: testing only the first body character in `isDeterministic`
  // turns the malformed line red.
  it("is true exactly for a well-formed body that starts with the marker", () => {
    expect(isDeterministic("usr_zcvt7epac0t1ebcsjfyf7cwz25")).toBe(true);
    expect(isDeterministic("usr_ZCVT7EPAC0T1EBCSJFYF7CWZ25")).toBe(true);
    expect(isDeterministic("zqz4cwzgyw8ks97869")).toBe(true);
    expect(isDeterministic("usr_01hf7yat0004h1")).toBe(false);
    expect(isDeterministic("usr_z9m4k7p2q3r8t5v6w0abcde")).toBe(false);
    expect(isDeterministic("usr_")).toBe(false);
    expect(isDeterministic(undefined)).toBe(false);
  });

  // Sabotage: ignoring the delimiter option in `isDeterministic` turns this
  // red.
  it("splits at the delimiter it is given", () => {
    expect(isDeterministic("usr.zcvt7epac0t1ebcsjfyf7cwz25", { delimiter: "." })).toBe(true);
    expect(isDeterministic("usr.zcvt7epac0t1ebcsjfyf7cwz25")).toBe(false);
    expect(refusal(() => isDeterministic("zqz4cwzgyw8ks97869", { delimiter: "" })).code).toBe(
      "invalid_option",
    );
  });
});

type Canonical = "xs" | "s" | "m" | "l" | "xl";
const STANDARD_RAND: Readonly<Record<Canonical, number>> = { xs: 0, s: 2, m: 5, l: 7, xl: 10 };
const COMPACT_RAND: Readonly<Record<Canonical, number>> = { xs: 1, s: 3, m: 6, l: 8, xl: 10 };

function rand(size: Canonical): Uint8Array {
  return new Uint8Array(STANDARD_RAND[size]).fill(0xa5);
}

function compactRand(size: Canonical): Uint8Array {
  return new Uint8Array(COMPACT_RAND[size]).fill(0x5a);
}
