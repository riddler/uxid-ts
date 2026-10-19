/**
 * Monotonic generation as uxid's wire format specifies it: ids from one
 * generator stay unique and in order within a millisecond. The generator is an
 * object the caller creates and holds; every piece of its state lives in that
 * object, so two generators never affect each other.
 */

import { encodeBytes, type LetterCase } from "./base32.js";
import { UxidError } from "./errors.js";
import {
  type ByteSource,
  draw,
  encodeTime,
  invalid,
  MAX_TIME,
  readCase,
  readCompactTime,
  readDelimiter,
  readPrefix,
  readSize,
  readTime,
  readWidth,
  withPrefix,
} from "./generate.js";
import type { Size } from "./sizes.js";

/**
 * Where a monotonic generator's random values come from. Both methods are
 * called with the random field's width in bytes, `w`, and answer an integer,
 * as a `bigint` or as a safe integer `number`.
 *
 * Pass one to replay known draws, as a test does; leave it out and the
 * generator draws from its `byteSource`.
 */
export interface MonotonicDraws {
  /** A fresh random value for the field: an integer from 0 to 2^(8w) - 1. */
  seed(width: number): bigint | number;
  /** A step within a millisecond: an integer from 1 to 2^(4w), inclusive. */
  step(width: number): bigint | number;
}

/**
 * The options of {@link createMonotonic}. The first six are defaults for every
 * id the generator makes, and a call to `generate` may override each of them;
 * the draws are the generator's own. Every option may be left out.
 */
export interface MonotonicOptions {
  /** The resource prefix; see {@link GenerateOptions.prefix}. */
  readonly prefix?: string;
  /** The size; see {@link GenerateOptions.size}. Defaults to `xl`. */
  readonly size?: Size;
  /** An explicit random field width in bytes, from 1 to 10; see {@link GenerateOptions.randSize}. */
  readonly randSize?: number;
  /**
   * Compact time; see {@link GenerateOptions.compactTime}. Defaults to true at
   * `xs`, whose standard body has no random field to step, and false at every
   * other size. A monotonic `xs` with this option set to false is refused.
   */
  readonly compactTime?: boolean;
  /** The letter case of the body. Defaults to `lower`. */
  readonly case?: LetterCase;
  /** The non-empty string between the prefix and the body. Defaults to `_`. */
  readonly delimiter?: string;
  /**
   * Where random bytes come from. Defaults to the platform's
   * `crypto.getRandomValues`; pass one on an engine that has none. Not read
   * when `draws` is given.
   */
  readonly byteSource?: ByteSource;
  /**
   * The draws themselves, in place of the byte source. Defaults to draws read
   * from the byte source: a fresh value is the field's bytes read big-endian,
   * and a step is 4w random bits, masked from ceil(w / 2) bytes, plus one, so
   * every step from 1 to 2^(4w) is equally likely.
   */
  readonly draws?: MonotonicDraws;
}

/**
 * The options of a monotonic generator's `generate`. Each one left out takes
 * the generator's own option.
 */
export interface MonotonicGenerateOptions {
  /** The resource prefix. */
  readonly prefix?: string;
  /** The size. */
  readonly size?: Size;
  /** An explicit random field width in bytes, from 1 to 10. */
  readonly randSize?: number;
  /** Compact time. */
  readonly compactTime?: boolean;
  /** The letter case of the body. */
  readonly case?: LetterCase;
  /** The non-empty string between the prefix and the body. */
  readonly delimiter?: string;
  /**
   * The current time, as milliseconds since the Unix epoch or as a `Date`,
   * from 0 to 2^48 - 1. Defaults to the current time. The id may carry a
   * later time than this one: the last id's time when the clock has not moved
   * past it, or the millisecond after when a step overflows the field.
   */
  readonly time?: number | Date;
  /**
   * Refused with `from_with_monotonic`: a deterministic id is a hash of
   * `from`, with no random field to step. Use {@link generate}.
   */
  readonly from?: string;
  /**
   * Refused with `rand_with_monotonic`: the generator chooses the random
   * field itself. Use {@link generate}.
   */
  readonly rand?: Uint8Array;
}

/** A monotonic generator, made by {@link createMonotonic}. */
export interface MonotonicGenerator {
  /**
   * Generates a time-based id that sorts after every id this generator made
   * before it for the same prefix and random width.
   *
   * @throws {UxidError} when the options contradict each other or the format;
   *   see {@link UxidErrorCode} for the codes.
   */
  generate(options?: MonotonicGenerateOptions): string;
}

interface Last {
  readonly time: number;
  readonly value: bigint;
}

interface Stream {
  readonly prefix: string;
  readonly compactTime: boolean;
  readonly width: number;
  readonly letterCase: LetterCase;
  readonly delimiter: string;
}

/**
 * Creates a monotonic generator: an object that keeps, per prefix and random
 * field width, the last time `T` it gave and the last random value `R` (the
 * random field read as one big-endian integer), and generates as the wire
 * format's "Monotonic generation" lays out:
 *
 * 1. with no state for the prefix and width, or a time later than `T`, the id
 *    carries the time and a fresh random value;
 * 2. with a time equal to or earlier than `T`, it carries `T` and `R` plus a
 *    step drawn from 1 to 2^(4w);
 * 3. when that sum reaches 2^(8w), it carries `T + 1` and a fresh value.
 *
 * The step spreads consecutive ids across a window rather than counting by
 * one; that hinders guessing the next id but does not make it unpredictable.
 * JavaScript runs one call at a time per realm, so a generator needs no lock.
 *
 * ```ts
 * const ids = createMonotonic({ prefix: "usr", size: "m" });
 * const first = ids.generate();
 * const second = ids.generate(); // sorts after first, even in the same millisecond
 * ```
 *
 * @throws {UxidError} when the options contradict each other or the format;
 *   see {@link UxidErrorCode} for the codes.
 */
export function createMonotonic(options: MonotonicOptions = {}): MonotonicGenerator {
  refuseConflicts(options as { readonly from?: unknown; readonly rand?: unknown });
  const draws = readDraws(options.draws, options.byteSource);
  resolveStream(options, {});
  const state = new Map<string, Last>();

  return {
    generate(call: MonotonicGenerateOptions = {}): string {
      refuseConflicts(call);
      const stream = resolveStream(options, call);
      const key = `${stream.width} ${stream.prefix}`;
      const last = next(state.get(key), readTime(call.time), stream.width, draws);
      const body =
        encodeTime(last.time, stream.compactTime, stream.letterCase) +
        encodeBytes(toBytes(last.value, stream.width), stream.letterCase);
      state.set(key, last);
      return withPrefix(stream.prefix, stream.delimiter, body);
    },
  };
}

function next(last: Last | undefined, now: number, width: number, draws: MonotonicDraws): Last {
  if (last === undefined || now > last.time) {
    return { time: now, value: checkedDraw(draws.seed(width), 0n, limit(width) - 1n, "seed") };
  }
  const value = last.value + checkedDraw(draws.step(width), 1n, 2n ** BigInt(4 * width), "step");
  if (value < limit(width)) return { time: last.time, value };
  if (last.time === MAX_TIME) {
    throw new UxidError(
      "invalid_option",
      "time cannot move past 2^48 - 1: the random field overflowed in the last millisecond a time body holds",
    );
  }
  return {
    time: last.time + 1,
    value: checkedDraw(draws.seed(width), 0n, limit(width) - 1n, "seed"),
  };
}

function limit(width: number): bigint {
  return 2n ** BigInt(8 * width);
}

function checkedDraw(value: unknown, low: bigint, high: bigint, method: string): bigint {
  const n =
    typeof value === "bigint"
      ? value
      : typeof value === "number" && Number.isSafeInteger(value)
        ? BigInt(value)
        : undefined;
  if (n !== undefined && n >= low && n <= high) return n;
  throw invalid(
    "draws",
    `an object whose ${method} answers an integer from ${low} to ${high}`,
    value,
  );
}

function toBytes(value: bigint, width: number): Uint8Array {
  const bytes = new Uint8Array(width);
  let rest = value;
  for (let i = width - 1; i >= 0; i--) {
    bytes[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return bytes;
}

function bigEndian(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function readDraws(draws: unknown, byteSource: unknown): MonotonicDraws {
  if (draws !== undefined) {
    const shaped = draws as Partial<MonotonicDraws> | null;
    if (typeof shaped?.seed === "function" && typeof shaped.step === "function") {
      return draws as MonotonicDraws;
    }
    throw invalid("draws", "an object with seed and step functions", draws);
  }
  if (byteSource !== undefined && typeof byteSource !== "function") {
    throw invalid("byteSource", "a function", byteSource);
  }
  return defaultDraws(byteSource as ByteSource | undefined);
}

function defaultDraws(byteSource: ByteSource | undefined): MonotonicDraws {
  return {
    seed: (width) => bigEndian(draw(width, byteSource)),
    step: (width) => {
      const bits = BigInt(4 * width);
      const mask = (1n << bits) - 1n;
      return (bigEndian(draw(Math.ceil(width / 2), byteSource)) & mask) + 1n;
    },
  };
}

function refuseConflicts(options: { readonly from?: unknown; readonly rand?: unknown }): void {
  if (options.from !== undefined) {
    throw new UxidError(
      "from_with_monotonic",
      "from cannot be used with a monotonic generator: a deterministic id has no random field to step; use generate",
    );
  }
  if (options.rand !== undefined) {
    throw new UxidError(
      "rand_with_monotonic",
      "rand cannot be used with a monotonic generator: the generator chooses the random field; use generate",
    );
  }
}

function resolveStream(defaults: MonotonicOptions, call: MonotonicGenerateOptions): Stream {
  const pick = <K extends keyof MonotonicGenerateOptions & keyof MonotonicOptions>(
    key: K,
  ): MonotonicGenerateOptions[K] | MonotonicOptions[K] =>
    call[key] !== undefined ? call[key] : defaults[key];

  const letterCase = readCase(pick("case"));
  const delimiter = readDelimiter(pick("delimiter"));
  const prefix = readPrefix(pick("prefix"));
  const size = readSize(pick("size"));
  const explicitCompact = pick("compactTime");
  const compactTime =
    explicitCompact === undefined ? size === "xs" : readCompactTime(explicitCompact);
  if (size === "xs" && !compactTime) {
    throw new UxidError(
      "invalid_option",
      "compactTime cannot be false for a monotonic xs: standard xs has no random field to step; leave compactTime out",
    );
  }
  const width = readWidth(pick("randSize"), size, compactTime);
  if (width === 0) {
    throw new UxidError(
      "invalid_option",
      "randSize must be at least 1 for a monotonic generator: an empty random field has nothing to step",
    );
  }
  return { prefix, compactTime, width, letterCase, delimiter };
}
