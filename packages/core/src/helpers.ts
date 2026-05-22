import { keccak256, toHex } from 'viem';

/** Convert basis points to a 0..1 fraction. */
export function bpsToFraction(bps: number): number {
  if (bps < 0 || bps > 10000) throw new Error('bps must be in [0,10000]');
  return bps / 10000;
}

/** Convert a 0..1 fraction to basis points. */
export function fractionToBps(f: number): number {
  if (f < 0 || f > 1) throw new Error('fraction must be in [0,1]');
  return Math.round(f * 10000);
}

/** Hash a string identifier consistently (matches Rust sha3::Keccak256 of UTF-8 bytes). */
export function hashId(...parts: string[]): `0x${string}` {
  return keccak256(toHex(parts.join('|')));
}
