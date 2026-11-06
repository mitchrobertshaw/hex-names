// Checks a name the way the contracts will: ENS normal form (ENSIP-15), length counted in
// characters like ENSv2's StringUtils.strlen, and the prices the registrar is deployed with.
import { ens_normalize } from "@adraffy/ens-normalize";

import { type Reservation, reservedFor, reservedNames } from "./reserved";

/** Dollars a year for names of 5 or more characters. */
export const YEARLY_PRICE = 5;

export type NameCheck =
  | { kind: "empty" }
  | { kind: "invalid"; reason: string }
  | { kind: "eth"; name: string; hex: NameCheck } // typed a .eth name; `hex` checks the .hex one
  | { kind: "too-short"; name: string }
  | { kind: "premium"; name: string; length: number }
  | { kind: "reserved"; name: string; reservedFor: string; given: boolean }
  | { kind: "available"; name: string; yearlyPrice: number };

/** The number of characters in a normalized name, as the price oracle counts them. */
export function nameLength(label: string): number {
  return [...label].length;
}

export function checkName(input: string, reserved: Map<string, Reservation> = reservedNames): NameCheck {
  const text = input.trim();
  if (!text) return { kind: "empty" };

  const lower = text.toLowerCase();
  if (lower.endsWith(".eth")) {
    const label = text.slice(0, -4).replace(/\.hex$/i, "");
    return { kind: "eth", name: lower, hex: checkName(label, reserved) };
  }
  const bare = lower.endsWith(".hex") ? text.slice(0, -4) : text;
  if (bare.includes(".")) {
    return { kind: "invalid", reason: "A .hex name is one word, with no dots in it." };
  }

  let label: string;
  try {
    label = ens_normalize(bare);
  } catch (error) {
    return { kind: "invalid", reason: explain(bare, error) };
  }
  if (!label) return { kind: "empty" };

  const name = `${label}.hex`;
  const length = nameLength(label);
  if (length < 3) return { kind: "too-short", name };
  const reservation = reserved.get(label);
  if (reservation) {
    return { kind: "reserved", name, reservedFor: reservedFor(reservation.note), given: reservation.given };
  }
  if (length < 5) return { kind: "premium", name, length };
  return { kind: "available", name, yearlyPrice: YEARLY_PRICE };
}

function explain(text: string, error: unknown): string {
  if (/\s/.test(text)) return "Names can't have spaces in them.";
  const detail = error instanceof Error ? error.message : String(error);
  return `Wallets wouldn't accept this name (${detail}).`;
}
