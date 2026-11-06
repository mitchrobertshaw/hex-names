import { describe, expect, it } from "vitest";

import { checkName, nameLength } from "./names";
import { parseReservedNames, reservedFor } from "./reserved";

const reserved = parseReservedNames(
  "name,wallet,who\n" +
    "yourfriendsommi,0xc6aB34235e4b2B7F42A3F6D78830E83760881667,Your Friend Sommi (@yourfriendSOMMI). note\n" +
    "pulsechain,,PulseChain\n",
);
const check = (input: string) => checkName(input, reserved);

describe("checkName", () => {
  it("prices names of 5 or more characters at $5 a year", () => {
    expect(check("alice")).toEqual({ kind: "available", name: "alice.hex", yearlyPrice: 5 });
  });

  it("lower-cases, trims and accepts a typed .hex ending", () => {
    expect(check("  Alice.HEX ")).toMatchObject({ kind: "available", name: "alice.hex" });
  });

  it("marks 3 and 4 characters as premium and refuses 1 and 2", () => {
    expect(check("abc")).toMatchObject({ kind: "premium", length: 3 });
    expect(check("abcd")).toMatchObject({ kind: "premium", length: 4 });
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
      hex: { kind: "available", name: "alice.hex", yearlyPrice: 5 },
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

describe("reservedFor", () => {
  it("takes the note up to its first bracket or full stop", () => {
    expect(reservedFor("Your Friend Sommi (@yourfriendSOMMI). More")).toBe("Your Friend Sommi");
    expect(reservedFor("PulseChain")).toBe("PulseChain");
    expect(reservedFor("A project. More")).toBe("A project");
  });
});
