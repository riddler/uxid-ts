/**
 * The size table: each size fixes the random field's width, for standard time
 * and for compact time. Compact time hands the 8 bits it frees to the random
 * field, except at xl, where the random field is already at its 10-byte cap.
 */

/** A size, short or long spelling; each long spelling is its short one. */
export type Size =
  | "xs"
  | "s"
  | "m"
  | "l"
  | "xl"
  | "xsmall"
  | "small"
  | "medium"
  | "large"
  | "xlarge";

/** The five sizes the wire format names. */
export type CanonicalSize = "xs" | "s" | "m" | "l" | "xl";

/** The widest random field at any size, in bytes. */
export const MAX_RAND_BYTES = 10;

const CANONICAL: Readonly<Record<Size, CanonicalSize>> = {
  xs: "xs",
  xsmall: "xs",
  s: "s",
  small: "s",
  m: "m",
  medium: "m",
  l: "l",
  large: "l",
  xl: "xl",
  xlarge: "xl",
};

const RAND_BYTES: Readonly<
  Record<CanonicalSize, { readonly standard: number; readonly compact: number }>
> = {
  xs: { standard: 0, compact: 1 },
  s: { standard: 2, compact: 3 },
  m: { standard: 5, compact: 6 },
  l: { standard: 7, compact: 8 },
  xl: { standard: 10, compact: 10 },
};

/** The wire format's name for a size, or undefined for a string that is not one. */
export function canonicalSize(size: string): CanonicalSize | undefined {
  return Object.hasOwn(CANONICAL, size) ? CANONICAL[size as Size] : undefined;
}

/** The random field's width, in bytes, for a size and time form. */
export function randBytesFor(size: CanonicalSize, compactTime: boolean): number {
  const row = RAND_BYTES[size];
  return compactTime ? row.compact : row.standard;
}

const HASH_CHARS: Readonly<Record<CanonicalSize, number>> = {
  xs: 9,
  s: 13,
  m: 17,
  l: 21,
  xl: 25,
};

/**
 * The number of hash characters in a deterministic body of a size: the body
 * is the marker and these characters, so it is as long as the size's standard
 * time body.
 */
export function hashCharsFor(size: CanonicalSize): number {
  return HASH_CHARS[size];
}
