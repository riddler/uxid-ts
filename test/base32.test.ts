import { describe, expect, it } from "vitest";
import { encodeLeadingBits } from "../src/base32.js";

describe("encodeLeadingBits", () => {
  // Sabotage: reading each group from its first byte alone, without the byte
  // after it, in `encodeLeadingBits` turns this red.
  it("reads a group that ends inside the last byte", () => {
    // 0xff 0xa5 is 11111 11110 10010 1: three whole groups, 31 30 18.
    expect(encodeLeadingBits(new Uint8Array([0xff, 0xa5]), 3, "lower")).toBe("zyj");
    expect(encodeLeadingBits(new Uint8Array([0xff, 0xa5]), 3, "upper")).toBe("ZYJ");
  });

  // Sabotage: writing one group more than `count` in `encodeLeadingBits`
  // turns this red.
  it("writes exactly the groups asked for and no short group", () => {
    expect(encodeLeadingBits(new Uint8Array([0x08, 0x00, 0x00]), 1, "lower")).toBe("1");
    expect(encodeLeadingBits(new Uint8Array([0x08, 0x00, 0x00]), 0, "lower")).toBe("");
  });
});
