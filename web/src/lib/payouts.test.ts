import { keccak256, toBytes } from "viem";
import { describe, expect, it } from "vitest";

import {
  dollarsText,
  findPayout,
  microDollarsText,
  payoutCsv,
  payoutReport,
  payoutTransfers,
  type ReferredPayment,
  type Referrer,
  tokenUnits,
  toMicroDollars,
  type Transfer,
} from "./payouts";

const tag = (name: string) => keccak256(toBytes(name));
const A = "0x00000000000000000000000000000000000000aa"; // owns mick.hex
const B = "0x00000000000000000000000000000000000000bb"; // owns sommi.hex
const USDC = "0x00000000000000000000000000000000000000c1";
const DAI = "0x00000000000000000000000000000000000000d1";
const ODD = "0x00000000000000000000000000000000000000e1";

const tokens = new Map([
  [USDC, { symbol: "USDC", decimals: 6 }],
  [DAI, { symbol: "DAI", decimals: 18 }],
] as const);

const referrers = new Map<`0x${string}`, Referrer>([
  [tag("mick"), { label: "mick", owner: "0x00000000000000000000000000000000000000AA" }], // any letter case
  [tag("sommi"), { label: "sommi", owner: B }],
  [tag("lapsed"), { label: "lapsed", owner: null }], // a name nobody owns now
  // tag("ghost") was never a name, so it isn't here at all
]);

let n = 0;
const pay = (kind: ReferredPayment["kind"], label: string, owner: `0x${string}` | null, referrer: string, amount: bigint, token: `0x${string}` = USDC): ReferredPayment => ({
  kind,
  label,
  owner,
  referrer: tag(referrer),
  amount,
  token,
  block: BigInt(++n),
  tx: `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`,
});

const usdc = (dollars: number) => BigInt(Math.round(dollars * 1e6));

describe("the referral payout report", () => {
  const report = payoutReport(
    [
      pay("purchase", "bob", "0x00000000000000000000000000000000000000c0", "mick", usdc(10)),
      pay("purchase", "carol", "0x00000000000000000000000000000000000000d0", "mick", 10n * 10n ** 18n, DAI),
      pay("renewal", "bob", "0x00000000000000000000000000000000000000c0", "mick", usdc(10)),
      pay("purchase", "mick2", A, "mick", usdc(10)), // mick's owner bought it: a self-referral
      pay("purchase", "dave", "0x00000000000000000000000000000000000000e0", "sommi", usdc(2.5)),
      pay("purchase", "eve", "0x00000000000000000000000000000000000000f0", "ghost", usdc(10)),
      pay("purchase", "frank", "0x0000000000000000000000000000000000000100", "lapsed", usdc(10)),
      pay("purchase", "gina", "0x0000000000000000000000000000000000000200", "mick", 5n, ODD),
    ],
    referrers,
    tokens,
  );

  it("pays each referrer 10% of what their buyers paid, purchases and renewals, USDC and DAI alike", () => {
    expect(report.pay.map((row) => [row.referrer, row.payTo, row.purchases, row.renewals, row.paid, row.owed])).toEqual([
      ["mick.hex", "0x00000000000000000000000000000000000000AA", 2, 1, usdc(30), usdc(3)],
      ["sommi.hex", B, 1, 0, usdc(2.5), usdc(0.25)],
    ]);
    expect(report.total).toEqual({ paid: usdc(32.5), owed: usdc(3.25) });
  });

  it("sets aside self-referrals, and tags that aren't a name anyone owns", () => {
    expect(report.selfReferrals.map((row) => [row.referrer, row.payTo, row.purchases, row.paid])).toEqual([["mick.hex", null, 1, usdc(10)]]);
    expect(report.noOwner.map((row) => [row.referrer, row.payTo, row.paid])).toEqual([
      [tag("ghost"), null, usdc(10)],
      ["lapsed.hex", null, usdc(10)],
    ]);
    expect(report.otherTokens.map((p) => p.label)).toEqual(["gina"]);
  });

  it("rounds what's owed down to USDC's smallest unit", () => {
    const tiny = payoutReport([pay("purchase", "x", null, "sommi", 33n)], referrers, tokens);
    expect(tiny.pay[0].owed).toBe(3n);
    expect(toMicroDollars(10n ** 18n, 18)).toBe(1_000_000n);
    expect(toMicroDollars(999_999_999_999n, 18)).toBe(0n);
    expect(toMicroDollars(150n, 2)).toBe(1_500_000n);
  });

  it("writes amounts the way they're sent and read", () => {
    expect(microDollarsText(usdc(3.25))).toBe("3.250000");
    expect(microDollarsText(7n)).toBe("0.000007");
    expect(dollarsText(usdc(3.25))).toBe("$3.25");
    expect(dollarsText(1_234_567_899_999n)).toBe("$1,234,567.89");
  });

  it("makes a spreadsheet of every referrer, paid or not", () => {
    expect(payoutCsv(report).split("\n")).toEqual([
      "referrer,pay_to,purchases,renewals,buyers_paid_usd,owed_usdc,status",
      "mick.hex,0x00000000000000000000000000000000000000AA,2,1,30.000000,3.000000,pay",
      `sommi.hex,${B},1,0,2.500000,0.250000,pay`,
      "mick.hex,,1,0,10.000000,0.000000,not paid: self-referral",
      `${tag("ghost")},,1,0,10.000000,0.000000,not paid: no one owns this name`,
      "lapsed.hex,,1,0,10.000000,0.000000,not paid: no one owns this name",
      "",
    ]);
  });
});

describe("paying out", () => {
  const report = payoutReport(
    [
      pay("purchase", "bob", "0x00000000000000000000000000000000000000c0", "mick", usdc(10)),
      pay("purchase", "dave", "0x00000000000000000000000000000000000000e0", "sommi", usdc(2.5)),
      pay("purchase", "tiny", "0x00000000000000000000000000000000000000e0", "sommi", 0n), // nothing owed for this one
    ],
    referrers,
    tokens,
  );
  const sent = (tx: string, to: string, value: bigint): Transfer => ({ to: to as `0x${string}`, value, tx: tx as `0x${string}`, block: 1n });

  it("sends each referrer what they're owed, in the token's own units", () => {
    expect(payoutTransfers(report, 6)).toEqual([
      { to: "0x00000000000000000000000000000000000000AA", amount: usdc(1) },
      { to: B, amount: usdc(0.25) },
    ]);
    expect(tokenUnits(usdc(1), 18)).toBe(10n ** 18n);
    expect(tokenUnits(usdc(1), 2)).toBe(100n);
  });

  it("knows a payout was already sent when one transaction paid everyone exactly", () => {
    const tx = "0x01";
    // Paid in full, in one go: found, whatever else went to these wallets.
    expect(findPayout(report, [sent("0x09", B, 5n), sent(tx, A, usdc(1)), sent(tx, B, usdc(0.25))], 6)?.tx).toBe(tx);
    // The same amounts in two transactions, or a different amount: not this payout.
    expect(findPayout(report, [sent("0x02", A, usdc(1)), sent("0x03", B, usdc(0.25))], 6)).toBeNull();
    expect(findPayout(report, [sent(tx, A, usdc(1)), sent(tx, B, usdc(0.24))], 6)).toBeNull();
    expect(findPayout(report, [], 6)).toBeNull();
  });
});
