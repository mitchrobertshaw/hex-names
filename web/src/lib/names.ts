// Checks and prices a name the way the contracts will: ENS normal form (ENSIP-15), length counted
// in characters like ENSv2's StringUtils.strlen, and the prices and multi-year discounts the
// registrar is deployed with (script/HexDeployer.sol; names.test.ts checks they match).
import { ens_normalize } from "@adraffy/ens-normalize";

import { type Reservation, reservedFor, reservedNames } from "./reserved";

/** Dollars a year by length, covering both chains. Names of 1 or 2 characters aren't for sale. */
export const PRICES = { three: 640, four: 160, fivePlus: 10 } as const;

/** Dollars a year for names of 5 or more characters. */
export const YEARLY_PRICE = PRICES.fivePlus;

/** Multi-year discounts: from `years`, the whole price is multiplied by `factor`. */
export const DISCOUNTS = [
  { years: 2, factor: 7 / 8 },
  { years: 3, factor: 11 / 16 },
  { years: 6, factor: 9 / 16 },
] as const;

/** The fee the hex-names bot adds to orders placed from Ethereum, in dollars. */
export const ETHEREUM_ORDER_FEE = 0.25;

export function yearlyPriceFor(length: number): number | null {
  if (length < 3) return null;
  if (length === 3) return PRICES.three;
  if (length === 4) return PRICES.four;
  return PRICES.fivePlus;
}

/** What `years` of a name of `length` characters cost before any discount, and after it. */
export function priceFor(length: number, years: number): { full: number; total: number; discount: number } {
  const full = (yearlyPriceFor(length) ?? 0) * years;
  let factor = 1;
  for (const step of DISCOUNTS) if (years >= step.years) factor = step.factor;
  return { full, total: full * factor, discount: 1 - factor };
}

export type NameCheck =
  | { kind: "empty" }
  | { kind: "invalid"; reason: string }
  | { kind: "eth"; name: string; hex: NameCheck } // typed a .eth name; `hex` checks the .hex one
  | { kind: "too-short"; name: string }
  | { kind: "premium"; name: string; length: number; yearlyPrice: number }
  | { kind: "reserved"; name: string; reservedFor: string; given: boolean }
  | { kind: "available"; name: string; length: number; yearlyPrice: number };

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
  const yearlyPrice = yearlyPriceFor(length);
  if (yearlyPrice === null) return { kind: "too-short", name };
  const reservation = reserved.get(label);
  if (reservation) {
    return { kind: "reserved", name, reservedFor: reservedFor(reservation.note), given: reservation.given };
  }
  if (length < 5) return { kind: "premium", name, length, yearlyPrice };
  return { kind: "available", name, length, yearlyPrice };
}

function explain(text: string, error: unknown): string {
  if (/\s/.test(text)) return "Names can't have spaces in them.";
  const detail = error instanceof Error ? error.message : String(error);
  return `Wallets wouldn't accept this name (${detail}).`;
}
