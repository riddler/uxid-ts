/**
 * uxid: prefixed, K-sortable identifiers a person can read, laid out as the
 * wire format of the Elixir `uxid` package specifies.
 */

export type { LetterCase } from "./base32.js";
export type {
  Decoded,
  DecodeOptions,
  DecodeRefusal,
  DecodeResult,
  IsDeterministicOptions,
  IsValidOptions,
} from "./decode.js";
export { decode, isDeterministic, isValid } from "./decode.js";
export type { UxidErrorCode } from "./errors.js";
export { UxidError } from "./errors.js";
export type { ByteSource, GenerateOptions } from "./generate.js";
export { generate } from "./generate.js";
export type { Size } from "./sizes.js";
