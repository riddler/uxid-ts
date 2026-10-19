import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { type GenerateOptions, generate, UxidError } from "../src/index.js";

function refusal(run: () => unknown): UxidError {
  try {
    run();
  } catch (error) {
    if (error instanceof UxidError) return error;
    throw error;
  }
  throw new Error("expected a UxidError, and nothing was thrown");
}

// A second reading of the wire format, written independently of the package:
// the platform's SHA-256 over Node's own UTF-8, the digest as a string of
// bits, cut into 5-bit groups.
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const COUNTS: Readonly<Record<string, number>> = { xs: 9, s: 13, m: 17, l: 21, xl: 25 };
function reference(prefix: string, from: string, size: string): string {
  const count = COUNTS[size] as number;
  const input = Buffer.concat([
    Buffer.from(prefix, "utf8"),
    Buffer.from([0]),
    Buffer.from(from, "utf8"),
    Buffer.from([0, count]),
  ]);
  const digest = createHash("sha256").update(input).digest();
  const bits = [...digest].map((byte) => byte.toString(2).padStart(8, "0")).join("");
  let body = "z";
  for (let i = 0; i < count; i++)
    body += ALPHABET[Number.parseInt(bits.slice(i * 5, i * 5 + 5), 2)];
  return prefix === "" ? body : `${prefix}_${body}`;
}

describe("the ids that lock the format", () => {
  // Sabotage: reading the digest from bit 1 instead of bit 0 in
  // `encodeLeadingBits` turns all three red.
  it("reproduces usr, alice@example.com, xl", () => {
    expect(generate({ prefix: "usr", from: "alice@example.com", size: "xl" })).toBe(
      "usr_zcvt7epac0t1ebcsjfyf7cwz25",
    );
  });

  it("reproduces cus, acme-corp, s", () => {
    expect(generate({ prefix: "cus", from: "acme-corp", size: "s" })).toBe("cus_zt9vnyfd85bff0");
  });

  it("reproduces no prefix, alice@example.com, m", () => {
    expect(generate({ from: "alice@example.com", size: "m" })).toBe("zqz4cwzgyw8ks97869");
  });
});

describe("generate with from", () => {
  // Sabotage: encoding a character from U+0800 as two bytes in `utf8`, or
  // reading a surrogate pair as two characters, turns this red.
  it("hashes from as UTF-8 at every encoded width, at every size", () => {
    const texts = [
      "",
      "\u007f",
      "\u0080",
      "߿",
      "ࠀ",
      "￿",
      "\u{10000}",
      "\u{10ffff}",
      "café 世界 \u{1f600}",
    ];
    for (const size of ["xs", "s", "m", "l", "xl"] as const) {
      for (const from of texts) {
        for (const prefix of ["", "usr"]) {
          expect(generate({ prefix, from, size }), `${prefix}/${size}/${from}`).toBe(
            reference(prefix, from, size),
          );
        }
      }
    }
  });

  // Sabotage: hashing the prefix's UTF-16 code units as single bytes turns
  // this red.
  it("hashes a non-ASCII prefix as UTF-8", () => {
    expect(generate({ prefix: "été", from: "alice@example.com" })).toBe(
      reference("été", "alice@example.com", "xl"),
    );
  });

  // Sabotage: defaulting the hash characters to those of `l` turns this red.
  it("defaults to xl and reads the long spellings", () => {
    const xl = "usr_zcvt7epac0t1ebcsjfyf7cwz25";
    expect(generate({ prefix: "usr", from: "alice@example.com" })).toBe(xl);
    expect(generate({ prefix: "usr", from: "alice@example.com", size: "xlarge" })).toBe(xl);
    expect(generate({ prefix: "usr", from: "alice@example.com", size: "xsmall" })).toBe(
      "usr_z1yhw20vag",
    );
  });

  // Sabotage: writing "_" in place of `delimiter` in `withPrefix` turns this
  // red.
  it("writes the delimiter but does not hash it", () => {
    expect(generate({ prefix: "usr", from: "alice@example.com", delimiter: "-" })).toBe(
      "usr-zcvt7epac0t1ebcsjfyf7cwz25",
    );
  });

  // Sabotage: reading `time`, `compactTime` or `randSize` on the `from` path
  // of `generate` turns this red.
  it("does not read the options of a time-based id", () => {
    const byteSource = vi.fn((count: number) => new Uint8Array(count));
    const id = generate({
      prefix: "usr",
      from: "alice@example.com",
      time: 1700000000000,
      compactTime: true,
      randSize: 3,
      byteSource,
    });
    expect(id).toBe("usr_zcvt7epac0t1ebcsjfyf7cwz25");
    expect(byteSource).not.toHaveBeenCalled();
    expect(
      generate({ from: "alice@example.com", time: -1, randSize: 99 } as unknown as GenerateOptions),
    ).toBe("z4krgegf6drn563pvqhya4tsx9");
  });

  // Sabotage: letting a `rand` of the right width through on the `from` path
  // turns this red.
  it("refuses rand whatever its width", () => {
    for (const width of [0, 2, 10]) {
      const error = refusal(() =>
        generate({ prefix: "usr", from: "acme-corp", size: "s", rand: new Uint8Array(width) }),
      );
      expect(error.code).toBe("rand_with_from");
    }
  });

  // Sabotage: accepting any value in `readFrom` turns this red.
  it("refuses a from that is not a string", () => {
    for (const from of [null, 42, new Uint8Array([1])]) {
      const error = refusal(() => generate({ from } as unknown as GenerateOptions));
      expect(error.code).toBe("invalid_option");
      expect(error.message).toContain("from");
    }
  });

  // Sabotage: encoding a lone surrogate as three bytes, as a replacement
  // character would be, in `utf8` turns this red.
  it("refuses text holding a lone surrogate", () => {
    for (const from of ["\ud800", "a\udc00b", "x\ud83d", "\ude00\ud83d"]) {
      const error = refusal(() => generate({ from }));
      expect(error.code).toBe("invalid_option");
      expect(error.message).toContain("from");
    }
    const error = refusal(() => generate({ prefix: "\ud800", from: "acme-corp" }));
    expect(error.message).toContain("prefix");
  });

  // Sabotage: making the hash input depend on `letterCase` in
  // `deterministicBody` turns this red.
  it("writes the same body in either case", () => {
    const lower = generate({ prefix: "cus", from: "acme-corp", size: "s" });
    const upper = generate({ prefix: "cus", from: "acme-corp", size: "s", case: "upper" });
    expect(upper).toBe(`cus_${lower.slice(4).toUpperCase()}`);
  });
});
