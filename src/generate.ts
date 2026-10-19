/**
 * Id generation as uxid's wire format lays it out, under an optional prefix:
 * a time field followed by a random field, or, given `from`, a deterministic
 * body hashed from a string.
 */

import { encodeBytes, encodeInteger, type LetterCase } from "./base32.js";
import { deterministicBody } from "./deterministic.js";
import { UxidError } from "./errors.js";
import {
  type CanonicalSize,
  canonicalSize,
  MAX_RAND_BYTES,
  randBytesFor,
  type Size,
} from "./sizes.js";

/**
 * A source of random bytes: called with a byte count, it answers a
 * `Uint8Array` of exactly that many bytes. It is called at most once per id,
 * and never when the random field is empty or fixed by `rand`.
 */
export type ByteSource = (count: number) => Uint8Array;

/** The options of {@link generate}. Every option may be left out. */
export interface GenerateOptions {
  /**
   * The resource prefix, written before the delimiter exactly as given. An
   * empty string is the same as no prefix: the id is the bare body.
   */
  readonly prefix?: string;
  /**
   * The size, which fixes the random field's width: `xs`, `s`, `m`, `l` or
   * `xl`, or the long spellings `xsmall`, `small`, `medium`, `large` and
   * `xlarge`. Defaults to `xl`. With `from`, it fixes the number of hash
   * characters instead.
   */
  readonly size?: Size;
  /**
   * A string to derive a deterministic id from: the same prefix, `from` and
   * size always give the same id, in either letter case. The body is the
   * marker `z` (`Z` in upper case) followed by characters of a SHA-256
   * digest of the prefix and `from`, at the size's standard body length.
   * Such an id is a name, not a secret: anyone who can guess `from` can
   * compute it. With `from`, the options `time`, `compactTime`, `randSize`
   * and `byteSource` do not apply and are not read, and `rand` is refused.
   */
  readonly from?: string;
  /**
   * An explicit random field width in bytes, from 0 to 10, which overrides
   * the size's width. A body of a width the size table does not list has the
   * same layout but a length a decoder refuses.
   */
  readonly randSize?: number;
  /**
   * Compact time: the low 40 bits of the time in 8 characters instead of 48
   * bits in 10, with the freed byte handed to the random field (except at
   * `xl`). Refused from mid-2038 until the 40-bit window rolls over in 2039.
   * Defaults to false.
   */
  readonly compactTime?: boolean;
  /** The letter case of the body; the prefix is never changed. Defaults to `lower`. */
  readonly case?: LetterCase;
  /** The non-empty string between the prefix and the body. Defaults to `_`. */
  readonly delimiter?: string;
  /**
   * The time, as milliseconds since the Unix epoch or as a `Date`, from 0 to
   * 2^48 - 1. Defaults to the current time.
   */
  readonly time?: number | Date;
  /**
   * Fixed random field bytes, exactly the random width of the request. This
   * exists for reproducible ids such as test vectors, and is never a source of
   * randomness: an id built from fixed bytes is exactly as guessable as those
   * bytes.
   */
  readonly rand?: Uint8Array;
  /**
   * Where random bytes come from. Defaults to the platform's
   * `crypto.getRandomValues`; pass one on an engine that has none.
   */
  readonly byteSource?: ByteSource;
}

const DEFAULT_DELIMITER = "_";
/** The latest time a time body holds: 2^48 - 1 milliseconds. */
export const MAX_TIME = 2 ** 48 - 1;
const COMPACT_WINDOW = 2 ** 40;
const MARKER = 31;

/**
 * Generates a time-based id.
 *
 * ```ts
 * generate({ prefix: "usr" }); // "usr_01..." with a fresh random field
 * generate({ prefix: "cus", size: "s", time: 1700000000000, rand: new Uint8Array([1, 35]) });
 * // "cus_01hf7yat0004h1"
 * generate({ prefix: "usr", from: "alice@example.com" });
 * // "usr_zcvt7epac0t1ebcsjfyf7cwz25", on every call
 * ```
 *
 * @throws {UxidError} when the options contradict each other or the format;
 *   see {@link UxidErrorCode} for the codes.
 */
export function generate(options: GenerateOptions = {}): string {
  const letterCase = readCase(options.case);
  const delimiter = readDelimiter(options.delimiter);
  const prefix = readPrefix(options.prefix);
  const size = readSize(options.size);
  if (options.from !== undefined) {
    const from = readFrom(options.from);
    if (options.rand !== undefined) {
      throw new UxidError(
        "rand_with_from",
        "rand and from cannot be used together: a deterministic id has no random field",
      );
    }
    return withPrefix(prefix, delimiter, deterministicBody(prefix, from, size, letterCase));
  }
  const compactTime = readCompactTime(options.compactTime);
  const time = readTime(options.time);
  const width = readWidth(options.randSize, size, compactTime);
  const rand =
    options.rand === undefined ? draw(width, options.byteSource) : fixed(options.rand, width);

  const body = encodeTime(time, compactTime, letterCase) + encodeBytes(rand, letterCase);
  return withPrefix(prefix, delimiter, body);
}

export function withPrefix(prefix: string, delimiter: string, body: string): string {
  return prefix === "" ? body : prefix + delimiter + body;
}

function readFrom(value: unknown): string {
  if (typeof value === "string") return value;
  throw invalid("from", "a string", value);
}

export function invalid(option: string, expected: string, got: unknown): UxidError {
  return new UxidError("invalid_option", `${option} must be ${expected}, got: ${describe(got)}`);
}

function describe(value: unknown): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

export function readCase(value: unknown): LetterCase {
  if (value === undefined) return "lower";
  if (value === "lower" || value === "upper") return value;
  throw invalid("case", `"lower" or "upper"`, value);
}

export function readDelimiter(value: unknown): string {
  if (value === undefined) return DEFAULT_DELIMITER;
  if (typeof value === "string" && value !== "") return value;
  throw invalid("delimiter", "a non-empty string", value);
}

export function readPrefix(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  throw invalid("prefix", "a string", value);
}

export function readSize(value: unknown): CanonicalSize {
  if (value === undefined) return "xl";
  const size = typeof value === "string" ? canonicalSize(value) : undefined;
  if (size !== undefined) return size;
  throw invalid("size", "one of xs, s, m, l, xl or a long spelling", value);
}

export function readCompactTime(value: unknown): boolean {
  if (value === undefined) return false;
  if (typeof value === "boolean") return value;
  throw invalid("compactTime", "a boolean", value);
}

export function readTime(value: unknown): number {
  const time = value === undefined ? Date.now() : value instanceof Date ? value.getTime() : value;
  if (typeof time === "number" && Number.isInteger(time) && time >= 0 && time <= MAX_TIME) {
    return time;
  }
  throw invalid("time", "an integer count of milliseconds from 0 to 2^48 - 1, or a Date", value);
}

export function readWidth(value: unknown, size: CanonicalSize, compactTime: boolean): number {
  if (value === undefined) return randBytesFor(size, compactTime);
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw invalid("randSize", "a non-negative integer", value);
  }
  if (value > MAX_RAND_BYTES) {
    throw new UxidError(
      "rand_size_too_large",
      `randSize must be at most ${MAX_RAND_BYTES} bytes, got: ${value}`,
    );
  }
  return value;
}

function fixed(rand: unknown, width: number): Uint8Array {
  if (!(rand instanceof Uint8Array)) throw invalid("rand", "a Uint8Array", rand);
  if (rand.length !== width) {
    throw new UxidError(
      "rand_width_mismatch",
      `rand must be exactly ${width} bytes for this request (the random field's width), got: ${rand.length}`,
    );
  }
  return rand;
}

export function draw(width: number, byteSource: unknown): Uint8Array {
  if (width === 0) return new Uint8Array(0);
  const source = byteSource === undefined ? platformByteSource() : byteSource;
  if (typeof source !== "function") throw invalid("byteSource", "a function", byteSource);
  const bytes: unknown = source(width);
  if (bytes instanceof Uint8Array && bytes.length === width) return bytes;
  throw invalid(
    "byteSource",
    `a function answering a Uint8Array of the ${width} bytes asked for`,
    bytes instanceof Uint8Array ? `${bytes.length} bytes` : bytes,
  );
}

interface PlatformCrypto {
  getRandomValues(array: Uint8Array): Uint8Array;
}

function platformByteSource(): ByteSource {
  const crypto = (globalThis as { crypto?: Partial<PlatformCrypto> }).crypto;
  const getRandomValues = crypto?.getRandomValues;
  if (crypto === undefined || typeof getRandomValues !== "function") {
    throw new UxidError(
      "byte_source_unavailable",
      "this engine has no crypto.getRandomValues; pass the byteSource option, a function answering that many secure random bytes",
    );
  }
  return (count) => getRandomValues.call(crypto, new Uint8Array(count));
}

export function encodeTime(time: number, compactTime: boolean, letterCase: LetterCase): string {
  if (!compactTime) return encodeInteger(time, 10, letterCase);
  const low = time % COMPACT_WINDOW;
  if (Math.floor(low / 2 ** 35) === MARKER) {
    throw new UxidError(
      "compact_time_out_of_range",
      `compactTime cannot encode the time ${time}: its first character would be the deterministic marker; use standard time`,
    );
  }
  return encodeInteger(low, 8, letterCase);
}
