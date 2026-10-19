/**
 * Crockford Base32 as the wire format writes it: 32 symbols in ASCII order,
 * `I`, `L`, `O` and `U` left out, no padding and no check symbol.
 */

const LOWER = "0123456789abcdefghjkmnpqrstvwxyz";
const UPPER = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** The letter case a body is written in. Case never applies to the prefix. */
export type LetterCase = "lower" | "upper";

function symbol(value: number, letterCase: LetterCase): string {
  return (letterCase === "upper" ? UPPER : LOWER).charAt(value);
}

/**
 * Writes `count` 5-bit groups of a non-negative integer of at most 53 bits,
 * most significant group first. The first group holds whatever bits remain
 * above the other groups, which is how the standard 48-bit time writes its
 * 3-bit first group. Arithmetic is by division, not by bitwise operators,
 * because the time is wider than 32 bits.
 */
export function encodeInteger(value: number, count: number, letterCase: LetterCase): string {
  let out = "";
  let rest = value;
  for (let i = 0; i < count; i++) {
    const group = rest % 32;
    out = symbol(group, letterCase) + out;
    rest = (rest - group) / 32;
  }
  return out;
}

/**
 * Writes bytes as 5-bit groups, most significant bit first. When the bit count
 * is not a multiple of 5 the last group is short, and it is written as its raw
 * value rather than shifted or padded: the two bytes `ff ff` are `zzz1`.
 */
export function encodeBytes(bytes: Uint8Array, letterCase: LetterCase): string {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += symbol((buffer >> bits) & 31, letterCase);
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += symbol(buffer, letterCase);
  return out;
}
