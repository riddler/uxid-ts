/**
 * The error a refused request throws.
 *
 * A refusal carries a `code`, a stable name a caller matches on, and a
 * `message`, a sentence for a person that is not part of the contract. The
 * codes the wire format names (its "Generation errors") are spelled exactly as
 * the conformance corpus spells them; the others are this package's own.
 */

/**
 * The name of a refusal.
 *
 * - `compact_time_out_of_range`: a compact time whose first character would
 *   be the deterministic marker (the low 40 bits of the time at or above
 *   31 x 2^35).
 * - `rand_width_mismatch`: fixed random bytes whose count is not the random
 *   width of the request.
 * - `rand_size_too_large`: an explicit random width above 10 bytes.
 * - `invalid_option`: an option of the wrong type or outside its range, such
 *   as an unknown size, an empty delimiter or a time outside 0 to 2^48 - 1.
 *   The message names the option.
 * - `byte_source_unavailable`: random bytes are needed, no `byteSource` was
 *   passed and the platform offers no `crypto.getRandomValues`.
 *
 * The first three are the corpus's names; the last two are this package's.
 */
export type UxidErrorCode =
  | "compact_time_out_of_range"
  | "rand_width_mismatch"
  | "rand_size_too_large"
  | "invalid_option"
  | "byte_source_unavailable";

/** Thrown when a request is refused. Match on `code`, not on `message`. */
export class UxidError extends Error {
  /** The refusal's stable name. */
  readonly code: UxidErrorCode;

  constructor(code: UxidErrorCode, message: string) {
    super(message);
    this.name = "UxidError";
    this.code = code;
  }
}
