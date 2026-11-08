import assert from "node:assert/strict";
import { test } from "node:test";

import { type Hex, getAddress, parseGwei } from "viem";

import { parseAmbMessage } from "../src/amb.ts";
import { loadConfig } from "../src/config.ts";
import { CLAIM_GAS, REFILL_GAS, holdReason, ownTransfer } from "../src/relay.ts";
import type { RelayState } from "../src/state.ts";

// A real message from the official bridge, made on a copy of PulseChain on 8 November 2026: 16 USDC
// sent to Ethereum with relayTokens, arriving as 15.952 after the bridge's 0.3% fee.
const SENT: Hex =
  "0x00050000eb21bb7b72d1042c471c6a52c971da8152d66d7a00000000000623964fd0aaa7506f3d9cb8274bdb946ec42a1b8751ef1715a3e4a142d8b698131108995174f37aeba10d001e8480020100017101272255bb000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000007aacfd23d0f33f5206fe8ca8c484aa08a9d0a9780000000000000000000000000000000000000000000000000000000000f36880";
const RECEIVER = getAddress("0x7aacfd23d0f33f5206fe8ca8c484aa08a9d0a978");
const ADDRESS = "0x000000000000000000000000000000000000dEaD";
const config = loadConfig({
  BOT_PRIVATE_KEY: `0x${"11".repeat(32)}`,
  PULSECHAIN_REGISTRAR: ADDRESS,
  PULSECHAIN_HEX_REGISTRY: ADDRESS,
  PULSECHAIN_ORDER_FILLER: ADDRESS,
  PULSECHAIN_MIRROR_SYNC: ADDRESS,
  ETHEREUM_ORDER_BOOK: ADDRESS,
  ETHEREUM_MIRROR_REGISTRAR: ADDRESS,
});
const t = config.treasury;

test("it knows its own USDC on the bridge, even if it lost track of sending it", () => {
  const message = parseAmbMessage(SENT);
  assert.equal(ownTransfer(message, RECEIVER, t.homeBridge, t.ethereumUsdc), 15_952_000n);
  assert.equal(ownTransfer(message, getAddress(ADDRESS), t.homeBridge, t.ethereumUsdc), null, "someone else's");
  assert.equal(ownTransfer(message, RECEIVER, getAddress(ADDRESS), t.ethereumUsdc), null, "not from the token bridge");
  assert.equal(ownTransfer(message, RECEIVER, t.homeBridge, getAddress(ADDRESS)), null, "not USDC");
});

const gasPrice = parseGwei("1");
const relay = (spent = 0n, lastClaim: Record<string, string> = {}): RelayState => ({ day: "2026-11-08", spent: spent.toString(), lastClaim, noted: {} });
const base = {
  now: 1_000_000n,
  cost: gasPrice * CLAIM_GAS,
  ethBalance: 10n ** 16n, // 0.01 ETH
  reserve: gasPrice * REFILL_GAS,
  limits: config.relayLimits,
};

test("a copy of a name is claimed when it can be", () => {
  assert.equal(holdReason({ ...base, kind: "mirror", label: "alice", relay: relay() }), null);
});

test("its own USDC is always claimed first and regardless: it buys the ETH for everything else", () => {
  assert.equal(holdReason({ ...base, kind: "own", ethBalance: 0n, relay: relay(10n ** 18n) }), null);
});

test("other claims leave enough ETH to claim its own USDC and buy more", () => {
  const low = base.reserve + base.cost - 1n;
  assert.match(holdReason({ ...base, kind: "mirror", label: "alice", ethBalance: low, relay: relay() })!, /low on ETH/);
  assert.match(holdReason({ ...base, kind: "settle", ethBalance: low, relay: relay() })!, /low on ETH/);
});

test("copying names keeps within the day's ETH limit; the rest wait for tomorrow", () => {
  const atLimit = relay(config.relayLimits.dailyEth - base.cost + 1n);
  assert.match(holdReason({ ...base, kind: "mirror", label: "alice", relay: atLimit })!, /today's limit/);
  assert.equal(holdReason({ ...base, kind: "settle", relay: atLimit }), null, "orders' refunds aren't held back by it");
});

test("a name copied in the last hour waits, so sending it back and forth costs the bot little", () => {
  const justCopied = relay(0n, { alice: (base.now - 600n).toString() });
  assert.match(holdReason({ ...base, kind: "mirror", label: "alice", relay: justCopied })!, /less than 60 minutes ago/);
  assert.equal(holdReason({ ...base, kind: "mirror", label: "bob", relay: justCopied }), null, "other names aren't held back");
  const anHourAgo = relay(0n, { alice: (base.now - 3600n).toString() });
  assert.equal(holdReason({ ...base, kind: "mirror", label: "alice", relay: anHourAgo }), null);
});
