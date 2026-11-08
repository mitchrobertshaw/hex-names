import assert from "node:assert/strict";
import { test } from "node:test";

import { parseEther } from "viem";

import { loadConfig } from "../src/config.ts";
import { type Action, type Balances, type Pending, margin, plan, usdcText } from "../src/treasury.ts";

const usdc = (dollars: number) => BigInt(Math.round(dollars * 1_000_000));
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
const t = config.treasury; // mainnet: keeps $150, buys $2 of PLS under 200,000 and $15 of ETH under 0.003

const healthy: Balances = { pls: parseEther("1000000"), float: usdc(150), eth: parseEther("0.01"), ethUsdc: 0n, budget: usdc(100) };
const nothing: Pending = { repayments: 0n, home: 0n, out: 0n, reserved: 0n, reservedBack: 0n };
const kinds = (actions: Action[]) => actions.map((a) => (a.kind === "warn" ? `warn:${a.key}` : `${a.kind} ${usdcText(a.usdc)}`));

test("mainnet's defaults: a $150 float, and gas bought a little at a time", () => {
  assert.equal(t.enabled, true);
  assert.equal(t.floatUsdc, usdc(150));
  assert.equal(t.plsLow, parseEther("200000"));
  assert.equal(t.plsBuyUsdc, usdc(2));
  assert.equal(t.ethLow, parseEther("0.003"));
  assert.equal(t.ethBuyUsdc, usdc(15));
  assert.equal(t.homeBridge, "0x4fD0aaa7506f3d9cB8274bdB946Ec42A1b8751Ef");
  assert.equal(t.foreignBridge, "0x1715a3E4A142d8b698131108995174F37aEBA10D");
  assert.equal(margin(t.floatUsdc), usdc(30));
});

test("the settings can be changed", () => {
  const custom = loadConfig({ ...process.env, BOT_PRIVATE_KEY: `0x${"11".repeat(32)}`, PULSECHAIN_REGISTRAR: ADDRESS, PULSECHAIN_HEX_REGISTRY: ADDRESS, PULSECHAIN_ORDER_FILLER: ADDRESS, PULSECHAIN_MIRROR_SYNC: ADDRESS, ETHEREUM_ORDER_BOOK: ADDRESS, ETHEREUM_MIRROR_REGISTRAR: ADDRESS, FLOAT_USDC: "700", ETH_LOW: "0.01", TREASURY: "false" });
  assert.equal(custom.treasury.floatUsdc, usdc(700));
  assert.equal(custom.treasury.ethLow, parseEther("0.01"));
  assert.equal(custom.treasury.enabled, false);
  assert.throws(() => loadConfig({ ...process.env, BOT_PRIVATE_KEY: `0x${"11".repeat(32)}`, PULSECHAIN_REGISTRAR: ADDRESS, PULSECHAIN_HEX_REGISTRY: ADDRESS, PULSECHAIN_ORDER_FILLER: ADDRESS, PULSECHAIN_MIRROR_SYNC: ADDRESS, ETHEREUM_ORDER_BOOK: ADDRESS, ETHEREUM_MIRROR_REGISTRAR: ADDRESS, FLOAT_USDC: "$150" }), /not a number/);
});

test("with everything in order, it does nothing", () => {
  assert.deepEqual(plan(healthy, nothing, t), []);
});

test("low on PLS, it buys more with its float", () => {
  assert.deepEqual(kinds(plan({ ...healthy, pls: parseEther("150000") }, nothing, t)), ["buy-pls 2.00"]);
  // The $2 comes out of the float, which is still within its margin: no draw for that.
  assert.deepEqual(kinds(plan({ ...healthy, pls: 0n, float: 0n, budget: 0n }, nothing, t)), ["warn:pls", "warn:budget"]);
});

test("low on ETH, it buys more with buyers' USDC on Ethereum, and sends the rest home", () => {
  assert.deepEqual(kinds(plan({ ...healthy, eth: parseEther("0.001"), ethUsdc: usdc(40) }, nothing, t)), ["buy-eth 15.00", "send-home 10.00"]);
});

test("low on ETH with no USDC on Ethereum, it sends some there first, once", () => {
  assert.deepEqual(kinds(plan({ ...healthy, eth: parseEther("0.001") }, nothing, t)), ["send-out 16.00"]);
  assert.deepEqual(kinds(plan({ ...healthy, eth: parseEther("0.001"), ethUsdc: usdc(5) }, nothing, t)), ["send-out 11.00"]);
  // Already on its way: nothing more.
  assert.deepEqual(plan({ ...healthy, eth: parseEther("0.001") }, { ...nothing, out: usdc(16) }, t), []);
});

test("buyers' payments on Ethereum go home, less enough for the next ETH", () => {
  assert.deepEqual(kinds(plan({ ...healthy, ethUsdc: usdc(30.25) }, nothing, t)), ["send-home 15.25"]);
  assert.deepEqual(plan({ ...healthy, ethUsdc: usdc(19.99) }, nothing, t), [], "under $5 over: it waits for more");
});

test("an order from Ethereum: the float lends, the buyer pays it back, nothing is drawn or counted twice", () => {
  // Committed to fill a $10 name: the float will lend $10 and get $10.25 back.
  const committed: Pending = { ...nothing, reserved: usdc(10), reservedBack: usdc(10.25) };
  assert.deepEqual(plan(healthy, committed, t), []);
  // Filled: $140 left, $10.25 owed back on Ethereum.
  assert.deepEqual(plan({ ...healthy, float: usdc(140) }, { ...nothing, repayments: usdc(10.25) }, t), []);
  // Paid back on Ethereum: it goes home.
  assert.deepEqual(kinds(plan({ ...healthy, float: usdc(140), ethUsdc: usdc(25.25) }, nothing, t)), ["send-home 10.25"]);
  // Home again: $150.25, the fee on top. Nothing to return until fees pass the margin.
  assert.deepEqual(plan({ ...healthy, float: usdc(150.25) }, nothing, t), []);
});

test("fees beyond the margin go to the payments wallet", () => {
  assert.deepEqual(kinds(plan({ ...healthy, float: usdc(181) }, nothing, t)), ["return 31.00"]);
  // But not money an order about to be filled needs.
  assert.deepEqual(plan({ ...healthy, float: usdc(181) }, { ...nothing, reserved: usdc(10), reservedBack: usdc(10.25) }, t), []);
});

test("short after paying for gas, it draws from the payments wallet's budget", () => {
  assert.deepEqual(kinds(plan({ ...healthy, float: usdc(100) }, nothing, t)), ["draw 50.00"]);
  // Not while what's owed back would cover it.
  assert.deepEqual(plan({ ...healthy, float: usdc(100) }, { ...nothing, repayments: usdc(40) }, t), []);
  assert.deepEqual(plan({ ...healthy, float: usdc(100) }, { ...nothing, home: usdc(40) }, t), []);
  // Up to the budget, and it says when that has run out.
  assert.deepEqual(kinds(plan({ ...healthy, float: usdc(100), budget: usdc(20) }, nothing, t)), ["draw 20.00", "warn:budget"]);
  assert.deepEqual(kinds(plan({ ...healthy, float: usdc(100), budget: 0n }, nothing, t)), ["warn:budget"]);
});

test("an order bigger than the float: it draws only what the order needs now", () => {
  // A 4-character name, $160: $10 more than the float holds. The buyer pays $160.25 back.
  const fourLetters: Pending = { ...nothing, reserved: usdc(160), reservedBack: usdc(160.25) };
  assert.deepEqual(kinds(plan(healthy, fourLetters, t)), ["draw 10.00"]);
  // Once paid back, the float holds $160.25: within its margin, so it keeps it.
  assert.deepEqual(plan({ ...healthy, float: usdc(160.25) }, nothing, t), []);
  // A 3-character name, $640, then paid back: the extra goes back to the payments wallet.
  const threeLetters: Pending = { ...nothing, reserved: usdc(640), reservedBack: usdc(640.25) };
  assert.deepEqual(kinds(plan({ ...healthy, budget: usdc(1000) }, threeLetters, t)), ["draw 490.00"]);
  // With too small a budget, it draws nothing for the order, which is refunded, and says so.
  assert.deepEqual(kinds(plan(healthy, threeLetters, t)), ["warn:order"]);
  // ...while still keeping its own float topped up.
  assert.deepEqual(kinds(plan({ ...healthy, float: usdc(100) }, threeLetters, t)), ["warn:order", "draw 50.00"]);
  assert.deepEqual(kinds(plan({ ...healthy, float: usdc(640.25) }, nothing, t)), ["return 490.25"]);
});

test("USDC amounts read as dollars and cents", () => {
  assert.equal(usdcText(usdc(10)), "10.00");
  assert.equal(usdcText(usdc(10.25)), "10.25");
  assert.equal(usdcText(1234n), "0.001234");
  assert.equal(usdcText(-usdc(3.5)), "-3.50");
});
