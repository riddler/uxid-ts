/**
 * Deterministic bodies: a hash of a caller's string, so the same inputs always
 * give the same id. The hash input is the prefix, a zero byte, the string as
 * UTF-8, a zero byte and one byte holding the number of hash characters; the
 * body is the marker followed by that many 5-bit groups of the SHA-256 digest.
 */

import { encodeLeadingBits, type LetterCase } from "./base32.js";
import { UxidError } from "./errors.js";
import { sha256 } from "./sha256.js";
import { type CanonicalSize, hashCharsFor } from "./sizes.js";

/**
 * The body of a deterministic id: `z` (`Z` in upper case) and the first
 * hash characters of the digest. Case is not part of the hash input.
 */
export function deterministicBody(
  prefix: string,
  from: string,
  size: CanonicalSize,
  letterCase: LetterCase,
): string {
  const count = hashCharsFor(size);
  const prefixBytes = utf8(prefix, "prefix");
  const fromBytes = utf8(from, "from");
  const input = new Uint8Array(prefixBytes.length + fromBytes.length + 3);
  input.set(prefixBytes, 0);
  input.set(fromBytes, prefixBytes.length + 1);
  input[input.length - 1] = count;
  const marker = letterCase === "upper" ? "Z" : "z";
  return marker + encodeLeadingBits(sha256(input), count, letterCase);
}

/**
 * The UTF-8 bytes of a string. A lone surrogate has no UTF-8 form, so a
 * string holding one is refused rather than hashed as a replacement
 * character, which would give two different strings the same id.
 */
function utf8(text: string, option: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdfff) {
      const next = text.charCodeAt(i + 1);
      if (code > 0xdbff || !(next >= 0xdc00 && next <= 0xdfff)) {
        throw new UxidError(
          "invalid_option",
          `${option} must be well-formed text, got a lone surrogate at index ${i}`,
        );
      }
      code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
      i++;
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
    }
  }
  return Uint8Array.from(bytes);
}
