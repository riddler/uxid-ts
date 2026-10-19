/**
 * Reading an id back: the prefix, the size and time form its body length
 * gives, whether the body is deterministic, and the time it carries. Decoding
 * never throws on a malformed id; it answers a result the caller inspects.
 */

import { UxidError } from "./errors.js";
import type { CanonicalSize } from "./sizes.js";

/**
 * Why a string is not an id, as the wire format names its refusals.
 *
 * - `empty`: the body is empty, as in an empty string or one ending in the
 *   delimiter.
 * - `invalid_length`: the body's length in UTF-8 bytes is not one the length
 *   table lists (10, 13, 14, 18, 21, 22, 24 or 26).
 * - `invalid_character`: a body character is not a Crockford Base32 symbol in
 *   either case. A value that is not a string at all is refused with this
 *   reason too.
 *
 * A body that breaks more than one rule is refused for the first it breaks, in
 * the order above.
 */
export type DecodeRefusal = "empty" | "invalid_length" | "invalid_character";

/** What a well-formed id says about itself. */
export interface Decoded {
  /**
   * Everything before the last delimiter, or `null` when the string has no
   * delimiter. A string that starts with the delimiter has the prefix `""`,
   * which is best read as no prefix.
   */
  readonly prefix: string | null;
  /** The size the body length gives. */
  readonly size: "xs" | "s" | "m" | "l" | "xl";
  /** Whether the body length is a compact-time one. */
  readonly compact: boolean;
  /** Whether the body starts with the deterministic marker `z` or `Z`. */
  readonly deterministic: boolean;
  /**
   * The time in milliseconds since the Unix epoch, or `null` for a
   * deterministic body, which carries none. A compact time carries only its
   * low 40 bits, and the rest comes from the decoder's clock (see
   * {@link DecodeOptions.now}).
   */
  readonly time: number | null;
}

/** The answer of {@link decode}: the decoded value, or the reason it was refused. */
export type DecodeResult =
  | { readonly ok: true; readonly value: Decoded }
  | { readonly ok: false; readonly error: DecodeRefusal };

/** The options of {@link decode}. Every option may be left out. */
export interface DecodeOptions {
  /**
   * The non-empty string between the prefix and the body; it must be the one
   * the id was generated with, as it is not recorded in the id. Defaults to
   * `_`.
   */
  readonly delimiter?: string;
  /**
   * The decoder's clock, as milliseconds since the Unix epoch or as a `Date`,
   * from 0 to 2^48 - 1. A compact body carries only the low 40 bits of its
   * time; the high bits are this clock's, less one 2^40 ms window when the
   * result would be more than one day ahead of it. Defaults to the current
   * time, and is read only for a compact body.
   */
  readonly now?: number | Date;
}

/** The options of {@link isValid}: those of {@link decode}, and a prefix to require. */
export interface IsValidOptions extends DecodeOptions {
  /**
   * The prefix the id must carry, exactly. Left out or empty, any prefix (or
   * none) is accepted.
   */
  readonly prefix?: string;
}

/** The options of {@link isDeterministic}. */
export interface IsDeterministicOptions {
  /** The delimiter, as for {@link decode}. Defaults to `_`. */
  readonly delimiter?: string;
}

const DEFAULT_DELIMITER = "_";
const MAX_TIME = 2 ** 48 - 1;
const COMPACT_WINDOW = 2 ** 40;
const ONE_DAY = 86_400_000;

// The length table: a body length in bytes to its size and time form.
const BY_LENGTH: ReadonlyMap<number, { size: CanonicalSize; compact: boolean }> = new Map([
  [10, { size: "xs", compact: false }],
  [13, { size: "s", compact: true }],
  [14, { size: "s", compact: false }],
  [18, { size: "m", compact: false }],
  [21, { size: "l", compact: true }],
  [22, { size: "l", compact: false }],
  [24, { size: "xl", compact: true }],
  [26, { size: "xl", compact: false }],
]);

const SYMBOLS = "0123456789abcdefghjkmnpqrstvwxyz";

// The value of each symbol, indexed by character code, in either case; -1 for
// a code that is not a symbol.
const VALUES: Int8Array = (() => {
  const values = new Int8Array(128).fill(-1);
  for (let value = 0; value < 32; value++) {
    const lower = SYMBOLS.charAt(value);
    values[lower.charCodeAt(0)] = value;
    values[lower.toUpperCase().charCodeAt(0)] = value;
  }
  return values;
})();

/**
 * Decodes an id. It never throws on a malformed id: the answer is
 * `{ ok: true, value }` for a well-formed one and `{ ok: false, error }` with
 * the {@link DecodeRefusal} otherwise.
 *
 * The body length gives the size and time form. The lengths 10 and 18 are
 * always read as standard time, so a compact xs or compact m id decodes to its
 * size with `compact` false and a time read from its first 10 characters,
 * which is not the time it was generated at.
 *
 * ```ts
 * decode("cus_01hf7yat0004h1");
 * // { ok: true, value: { prefix: "cus", size: "s", compact: false,
 * //   deterministic: false, time: 1700000000000 } }
 * decode("usr_");
 * // { ok: false, error: "empty" }
 * ```
 *
 * @throws {UxidError} with the code `invalid_option` when an option is of the
 *   wrong type or outside its range; a malformed id is never thrown for.
 */
export function decode(id: unknown, options: DecodeOptions = {}): DecodeResult {
  const delimiter = readDelimiter(options.delimiter);
  const now = readNow(options.now);
  if (typeof id !== "string") return { ok: false, error: "invalid_character" };

  const { prefix, body } = split(id, delimiter);
  const refusal = refuse(body);
  if (refusal !== undefined) return { ok: false, error: refusal };

  const { size, compact } = BY_LENGTH.get(body.length) as { size: CanonicalSize; compact: boolean };
  const deterministic = value(body, 0) === 31;
  const time = deterministic ? null : compact ? compactTime(body, now) : standardTime(body);
  return { ok: true, value: { prefix, size, compact, deterministic, time } };
}

/**
 * Whether a value is a well-formed id, that is whether {@link decode} answers
 * a value for it, and, given `prefix`, whether it carries that prefix.
 *
 * ```ts
 * isValid("cus_01hf7yat0004h1"); // true
 * isValid("cus_01hf7yat0004h1", { prefix: "usr" }); // false
 * ```
 *
 * @throws {UxidError} with the code `invalid_option`, as {@link decode} does.
 */
export function isValid(id: unknown, options: IsValidOptions = {}): boolean {
  const expected = readPrefix(options.prefix);
  const result = decode(id, options);
  if (!result.ok) return false;
  return expected === "" || result.value.prefix === expected;
}

/**
 * Whether a value is a well-formed deterministic id: one {@link decode}
 * answers a value for whose body starts with the marker `z` or `Z`. A
 * malformed string is not one, whatever its first body character.
 *
 * ```ts
 * isDeterministic("usr_zcvt7epac0t1ebcsjfyf7cwz25"); // true
 * isDeterministic("usr_01hf7yat0004h1"); // false
 * ```
 *
 * @throws {UxidError} with the code `invalid_option`, as {@link decode} does.
 */
export function isDeterministic(id: unknown, options: IsDeterministicOptions = {}): boolean {
  const result = decode(id, { delimiter: readDelimiter(options.delimiter) });
  return result.ok && result.value.deterministic;
}

// The body is everything after the last delimiter, read left to right, and the
// prefix everything before it; with no delimiter there is no prefix.
function split(id: string, delimiter: string): { prefix: string | null; body: string } {
  const parts = id.split(delimiter);
  const body = parts.pop() as string;
  return { prefix: parts.length === 0 ? null : parts.join(delimiter), body };
}

function refuse(body: string): DecodeRefusal | undefined {
  if (body === "") return "empty";
  if (!BY_LENGTH.has(utf8Length(body))) return "invalid_length";
  for (let i = 0; i < body.length; i++) {
    if (value(body, i) < 0) return "invalid_character";
  }
  return undefined;
}

// The length in UTF-8 bytes, so that a body holding a character outside ASCII
// is refused for the same reason in every language. A lone surrogate counts as
// the three bytes of the replacement character an encoder writes for it.
function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && isLowSurrogate(text.charCodeAt(i + 1))) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

// The value of the body character at `index`, or -1 when it is not a symbol.
function value(body: string, index: number): number {
  return VALUES[body.charCodeAt(index)] ?? -1;
}

// Reads `count` characters from `start` as one integer, five bits each.
// Arithmetic is by multiplication, not by bitwise operators, because a time is
// wider than 32 bits.
function integer(body: string, start: number, count: number): number {
  let result = 0;
  for (let i = start; i < start + count; i++) result = result * 32 + value(body, i);
  return result;
}

// The standard 48-bit time: the first character's low 3 bits, then nine
// 5-bit groups. A producer never writes a first character above 7.
function standardTime(body: string): number {
  return (value(body, 0) % 8) * 2 ** 45 + integer(body, 1, 9);
}

// The compact time: the low 40 bits from the body and the high bits from the
// clock, less one window when that lands more than a day ahead of the clock.
function compactTime(body: string, now: () => number): number {
  const clock = now();
  const time = Math.floor(clock / COMPACT_WINDOW) * COMPACT_WINDOW + integer(body, 0, 8);
  return time - clock > ONE_DAY ? time - COMPACT_WINDOW : time;
}

function invalid(option: string, expected: string, got: unknown): UxidError {
  const shown = typeof got === "string" ? JSON.stringify(got) : String(got);
  return new UxidError("invalid_option", `${option} must be ${expected}, got: ${shown}`);
}

function readDelimiter(value: unknown): string {
  if (value === undefined) return DEFAULT_DELIMITER;
  if (typeof value === "string" && value !== "") return value;
  throw invalid("delimiter", "a non-empty string", value);
}

function readPrefix(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  throw invalid("prefix", "a string", value);
}

// The clock is checked when it is given, and the current time read only when
// a compact body needs it.
function readNow(value: unknown): () => number {
  if (value === undefined) return () => Date.now();
  const time = value instanceof Date ? value.getTime() : value;
  if (typeof time === "number" && Number.isInteger(time) && time >= 0 && time <= MAX_TIME) {
    return () => time;
  }
  throw invalid("now", "an integer count of milliseconds from 0 to 2^48 - 1, or a Date", value);
}
