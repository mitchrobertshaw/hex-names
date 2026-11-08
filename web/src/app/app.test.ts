import nacl from "tweetnacl";
import { bytesToHex, decodeAbiParameters, hexToBytes, keccak256, toBytes, zeroAddress } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captureReferral,
  LAUNCH_OFFER_DAYS,
  launchOffer,
  REMEMBER_DAYS,
  referralLink,
  referralOfferText,
  referrerFrom,
} from "../lib/referral";
import { commitmentOf, encodePurchase, labelId, NO_REFERRER, type Purchase, referralTag, sealFor } from "./order";
import { usdcText } from "../lib/payouts";
import { localInfo } from "./lookup";
import { renewableYears } from "./ManagePanel";
import { hrefOf, modeOf, parse, type Place } from "./router";

const purchase: Purchase = {
  label: "alice",
  owner: "0x328809Bc894f92807417D2dAD6b7C998c1aFdac6",
  secret: `0x${"11".repeat(32)}`,
  subregistry: zeroAddress,
  resolver: zeroAddress,
  duration: 31_536_000n,
  referrer: NO_REFERRER,
};

describe("buying", () => {
  it("commits exactly as the deployed registrar's makeCommitment does", () => {
    // The same vector as bot/test/reveal.test.ts, from ETHRegistrar.makeCommitment on a deployment.
    expect(commitmentOf(purchase)).toBe("0xd9a764372bda56ec1d542c80b3d205148b386b601cf67981e3cbe759e463f941");
  });

  it("seals an order so the bot's key opens it, in the bot's format", () => {
    const bot = nacl.box.keyPair();
    const sealed = hexToBytes(sealFor(purchase, bytesToHex(bot.publicKey)));
    expect(sealed[0]).toBe(1); // version
    const oneOff = sealed.slice(1, 33);
    const nonce = sealed.slice(33, 57);
    const opened = nacl.box.open(sealed.slice(57), nonce, oneOff, bot.secretKey);
    expect(opened).not.toBeNull();
    expect(bytesToHex(opened!)).toBe(encodePurchase(purchase));
    const [label, owner] = decodeAbiParameters([{ type: "string" }, { type: "address" }], encodePurchase(purchase));
    expect([label, owner]).toEqual(["alice", purchase.owner]);
    expect(nacl.box.open(sealed.slice(57), nonce, oneOff, nacl.box.keyPair().secretKey)).toBeNull();
  });

  it("knows a name by keccak256 of its label, as ENSv2 does", () => {
    expect(labelId("alice")).toBe(BigInt(keccak256(toBytes("alice"))));
  });
});

describe("referrals", () => {
  it("take a .hex name from the link, in any case, with or without .hex", () => {
    expect(referrerFrom("Mick")).toBe("mick");
    expect(referrerFrom("mick.hex")).toBe("mick");
    expect(referrerFrom("mi")).toBeNull(); // too short to be a name
    expect(referrerFrom("not a name")).toBeNull();
    expect(referrerFrom(null)).toBeNull();
    expect(referralLink("mick")).toBe("https://hexns.domains/?ref=mick");
  });

  afterEach(() => vi.unstubAllGlobals());

  it("are remembered for 58 days after the visitor clicks the link", () => {
    const saved = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    });
    const visit = (search: string) => vi.stubGlobal("window", { location: { search } });
    const day = 24 * 60 * 60 * 1000;
    const clicked = Date.UTC(2026, 10, 7);

    visit("?ref=mick");
    expect(captureReferral(clicked)).toBe("mick");
    visit(""); // later visits, without the link
    expect(REMEMBER_DAYS).toBe(58);
    expect(captureReferral(clicked + 58 * day)).toBe("mick");
    expect(captureReferral(clicked + 58 * day + 1)).toBeNull();
  });

  it("earn 10% for the first 58 days after launch", () => {
    expect(LAUNCH_OFFER_DAYS).toBe(58);
    expect(REMEMBER_DAYS).toBe(LAUNCH_OFFER_DAYS); // a link clicked at launch lasts the whole offer
    const offer = launchOffer("2026-12-01", Date.UTC(2026, 11, 1));
    // 1 December 2026 to 27 January 2027 is 58 days.
    expect(offer?.lastDay.toISOString()).toBe("2027-01-27T00:00:00.000Z");
    expect(offer?.open).toBe(true);
    expect(launchOffer("2026-12-01", Date.UTC(2027, 0, 27, 23, 59))?.open).toBe(true);
    expect(launchOffer("2026-12-01", Date.UTC(2027, 0, 28))?.open).toBe(false);
    expect(launchOffer(undefined)).toBeNull();
    expect(launchOffer("1 December")).toBeNull();

    expect(referralOfferText(offer)).toBe(
      "Share it. Until 27 January 2027, when someone buys a name through it, you earn 10% of what they pay.",
    );
    expect(referralOfferText(launchOffer("2026-12-01", Date.UTC(2027, 1, 1)))).toBe(
      "The launch offer, 10% of what buyers paid through referral links, ended on 27 January 2027.",
    );
    expect(referralOfferText(null)).toBe(
      "Share it. For the first 58 days after launch, when someone buys a name through it, you earn 10% of what they pay.",
    );
  });

  it("tag a purchase with the referrer's name, never their own", () => {
    expect(referralTag("mick", "alice")).toBe(keccak256(toBytes("mick")));
    expect(referralTag("alice", "alice")).toBe(NO_REFERRER);
    expect(referralTag(null, "alice")).toBe(NO_REFERRER);
  });
});

describe("the app's pages", () => {
  const at = (url: string): Place => {
    const u = new URL(url);
    return { pathname: u.pathname, hash: u.hash, hostname: u.hostname, protocol: u.protocol };
  };

  it("sit at the root of app.hexns.domains", () => {
    expect(modeOf(at("https://app.hexns.domains/alice.hex"))).toEqual({ base: "", hash: false });
    expect(parse(at("https://app.hexns.domains/alice.hex"))).toEqual({ page: "name", label: "alice" });
    expect(parse(at("https://app.hexns.domains/names"))).toEqual({ page: "names" });
    expect(parse(at("https://app.hexns.domains/"))).toEqual({ page: "search" });
    expect(hrefOf({ page: "name", label: "alice" }, at("https://app.hexns.domains/"))).toBe("/alice.hex");
  });

  it("sit under /app on a preview link", () => {
    const place = at("https://deploy-preview-5--hexns.netlify.app/app/Alice.hex");
    expect(modeOf(place)).toEqual({ base: "/app", hash: false });
    expect(parse(place)).toEqual({ page: "name", label: "alice" });
    expect(hrefOf({ page: "names" }, place)).toBe("/app/names");
  });

  it("include the referral payout report at /referrals, which isn't a name", () => {
    expect(parse(at("https://app.hexns.domains/referrals"))).toEqual({ page: "referrals" });
    expect(parse(at("https://app.hexns.domains/referrals.hex"))).toEqual({ page: "name", label: "referrals" });
    expect(parse(at("https://hexns-testnet.netlify.app/app/referrals"))).toEqual({ page: "referrals" });
    expect(hrefOf({ page: "referrals" }, at("https://hexns-testnet.netlify.app/app/"))).toBe("/app/referrals");
  });

  it("go after a # anywhere else, such as a copy opened from a file", () => {
    const place = at("file:///Users/me/hexns-app.html#/b%C3%BCcher.hex");
    expect(modeOf(place)).toEqual({ base: "", hash: true });
    expect(parse(place)).toEqual({ page: "name", label: "bücher" });
    expect(hrefOf({ page: "search" }, place)).toBe("#/");
  });
});

describe("a name's page", () => {
  it("says a name over 63 bytes is too long, and doesn't offer it", () => {
    expect(localInfo(`${"a".repeat(63)}.hex`)).toMatchObject({ kind: "available", length: 63 });
    expect(localInfo("a".repeat(64))).toEqual({ kind: "too-long", label: "a".repeat(64), length: 64, bytes: 64 });
    expect(localInfo("🔥".repeat(16))).toMatchObject({ kind: "too-long", length: 16, bytes: 64 });
  });
});

describe("renewing", () => {
  it("goes up to 5 years ahead, the most a name can be paid for", () => {
    const now = 1_800_000_000;
    const year = 365 * 86_400;
    expect(renewableYears(now + year, now)).toBe(4);
    expect(renewableYears(now + 4 * year, now)).toBe(1);
    expect(renewableYears(now + 4.5 * year, now)).toBe(0); // half a year more to wait
    expect(renewableYears(now + 5 * year, now)).toBe(0);
    expect(renewableYears(now - 10 * 86_400, now)).toBe(5); // expired, in its grace period
  });
});

describe("the payout report page", () => {
  it("shows USDC to send without needless zeros", () => {
    expect(usdcText(3_250_000n)).toBe("3.25");
    expect(usdcText(1_000_000n)).toBe("1.00");
    expect(usdcText(7n)).toBe("0.000007");
    expect(usdcText(1_234_567_891_230n)).toBe("1,234,567.89123");
  });
});
