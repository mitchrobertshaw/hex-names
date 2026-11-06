import { describe, expect, it } from "vitest";

import botConfig from "../../../bot/src/config.ts?raw";
import deployer from "../../../script/HexDeployer.sol?raw";
import page from "../../index.html?raw";

import { checkName, DISCOUNTS, ETHEREUM_ORDER_FEE, nameLength, PRICES, priceFor, YEARLY_PRICE } from "./names";
import { parseReservedNames, reservedFor } from "./reserved";

const reserved = parseReservedNames(
  "name,wallet,who\n" +
    "yourfriendsommi,0xc6aB34235e4b2B7F42A3F6D78830E83760881667,Your Friend Sommi (@yourfriendSOMMI). note\n" +
    "pulsechain,,PulseChain\n",
);
const check = (input: string) => checkName(input, reserved);

describe("checkName", () => {
  it("prices names of 5 or more characters at $10 a year", () => {
    expect(check("alice")).toEqual({ kind: "available", name: "alice.hex", length: 5, yearlyPrice: 10 });
  });

  it("lower-cases, trims and accepts a typed .hex ending", () => {
    expect(check("  Alice.HEX ")).toMatchObject({ kind: "available", name: "alice.hex" });
  });

  it("prices 3 and 4 characters as premium and refuses 1 and 2", () => {
    expect(check("abc")).toMatchObject({ kind: "premium", length: 3, yearlyPrice: 640 });
    expect(check("abcd")).toMatchObject({ kind: "premium", length: 4, yearlyPrice: 160 });
    expect(check("ab")).toEqual({ kind: "too-short", name: "ab.hex" });
    expect(check("a")).toMatchObject({ kind: "too-short" });
  });

  it("counts characters, not bytes, like the price oracle", () => {
    expect(nameLength("🔥🔥🔥")).toBe(3);
    expect(check("🔥🔥")).toMatchObject({ kind: "too-short" });
  });

  it("says who a reserved name is for", () => {
    expect(check("yourfriendsommi")).toEqual({
      kind: "reserved",
      name: "yourfriendsommi.hex",
      reservedFor: "Your Friend Sommi",
      given: true,
    });
    expect(check("PulseChain")).toMatchObject({ kind: "reserved", reservedFor: "PulseChain", given: false });
  });

  it("catches .eth and checks the .hex name instead", () => {
    expect(check("alice.eth")).toEqual({
      kind: "eth",
      name: "alice.eth",
      hex: { kind: "available", name: "alice.hex", length: 5, yearlyPrice: 10 },
    });
    expect(check("alice.hex.eth")).toMatchObject({ kind: "eth", hex: { name: "alice.hex" } });
  });

  it("refuses dots, spaces and characters wallets won't accept", () => {
    expect(check("sub.alice")).toMatchObject({ kind: "invalid" });
    expect(check("two words")).toEqual({ kind: "invalid", reason: "Names can't have spaces in them." });
    expect(check("hey!")).toMatchObject({ kind: "invalid" });
  });

  it("drops invisible characters, as wallets do when they normalize a name", () => {
    expect(check("ali​ce")).toMatchObject({ kind: "available", name: "alice.hex" }); // zero-width space
  });

  it("treats blank input as nothing typed", () => {
    expect(check("   ")).toEqual({ kind: "empty" });
    expect(check(".hex")).toEqual({ kind: "empty" });
  });
});

describe("priceFor", () => {
  it("applies the multi-year discount to the whole price", () => {
    expect(priceFor(5, 1)).toEqual({ full: 10, total: 10, discount: 0 });
    expect(priceFor(5, 2)).toEqual({ full: 20, total: 17.5, discount: 0.125 });
    expect(priceFor(5, 3).total).toBeCloseTo(20.625);
    expect(priceFor(3, 1).total).toBe(640);
  });

  it("follows the contracts even where 6 years costs less than 5", () => {
    expect(priceFor(5, 5).total).toBeCloseTo(34.375);
    expect(priceFor(5, 6).total).toBeCloseTo(33.75);
  });
});

describe("the prices", () => {
  const number = (pattern: RegExp) => Number(deployer.match(pattern)?.[1]);

  it("match what the contracts are deployed with", () => {
    expect(number(/YEARLY_PRICE_5_PLUS\s*=\s*(\d+)/), "5+ characters").toBe(PRICES.fivePlus);
    expect(number(/YEARLY_PRICE_4\s*=\s*(\d+)/), "4 characters").toBe(PRICES.four);
    expect(number(/YEARLY_PRICE_3\s*=\s*(\d+)/), "3 characters").toBe(PRICES.three);
    expect(YEARLY_PRICE).toBe(PRICES.fivePlus);
  });

  it("use the contracts' multi-year discounts", () => {
    // e.g. "duration: uint64(2 * SEC_PER_YEAR), numer: DISCOUNT_DENOMINATOR / 8 * 7"
    const steps = [...deployer.matchAll(/uint64\((\d+) \* SEC_PER_YEAR\), numer: DISCOUNT_DENOMINATOR \/ (\d+) \* (\d+)/g)];
    expect(steps.map(([, years, over, times]) => ({ years: Number(years), factor: Number(times) / Number(over) }))).toEqual(
      DISCOUNTS.map((d) => ({ years: d.years, factor: d.factor })),
    );
  });

  it("add the bot's Ethereum order fee", () => {
    expect(Number(botConfig.match(/MIN_FEE_USDC"\) \?\? "([\d.]+)"/)?.[1])).toBe(ETHEREUM_ORDER_FEE);
  });

  it("is the one in the page description", () => {
    expect(page).toContain(`$${YEARLY_PRICE} a year`);
  });
});

describe("reservedFor", () => {
  it("takes the note up to its first bracket or full stop", () => {
    expect(reservedFor("Your Friend Sommi (@yourfriendSOMMI). More")).toBe("Your Friend Sommi");
    expect(reservedFor("PulseChain")).toBe("PulseChain");
    expect(reservedFor("A project. More")).toBe("A project");
  });
});
