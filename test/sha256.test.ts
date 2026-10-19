import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256 } from "../src/sha256.js";

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");
const ascii = (text: string) => new Uint8Array(Buffer.from(text, "latin1"));

describe("sha256", () => {
  // NIST's published SHA-256 examples for FIPS 180-4 ("abc" in one block and
  // the 448-bit message in two), the long message of one million "a", the
  // 896-bit message of the NIST test vector set and the empty message, each
  // with its published digest.
  const vectors: readonly (readonly [string, Uint8Array, string])[] = [
    [
      "the empty message",
      ascii(""),
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ],
    ["abc", ascii("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "the 448-bit two-block message",
      ascii("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
    [
      "the 896-bit message",
      ascii(
        "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu",
      ),
      "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1",
    ],
    [
      "one million repetitions of a",
      new Uint8Array(1_000_000).fill(0x61),
      "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
    ],
  ];

  // Sabotage: changing one round constant in `K` (0x428a2f98 to 0x428a2f99)
  // turns every vector red.
  it.each(vectors)("hashes %s", (_name, message, digest) => {
    expect(hex(sha256(message))).toBe(digest);
  });

  // Sabotage: padding to `Math.floor((length + 9) / 64) + 1` blocks turns the
  // 55-byte length red; writing the bit length without the `* 8` turns every
  // length red.
  it("agrees with the platform digest at every length across the padding boundaries", () => {
    for (let length = 0; length <= 300; length++) {
      const message = Uint8Array.from({ length }, (_, i) => (i * 131 + length) & 0xff);
      const expected = createHash("sha256").update(message).digest("hex");
      expect(hex(sha256(message)), `length ${length}`).toBe(expected);
    }
  });

  // Sabotage: hoisting the `digest` array to module level, so every call
  // answers the same array, turns this red.
  it("answers a fresh 32-byte array on each call", () => {
    const first = sha256(ascii("abc"));
    const second = sha256(ascii("abc"));
    expect(first).toHaveLength(32);
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
