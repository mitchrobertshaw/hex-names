import assert from "node:assert/strict";
import { test } from "node:test";

import { createPublicClient, custom, parseGwei } from "viem";

import { loadConfig } from "../src/config.ts";
import { CHAINS } from "../src/context.ts";

const KEY = `0x${"11".repeat(32)}`;
const ADDRESS = "0x000000000000000000000000000000000000dEaD";
const DEPLOYED = {
  BOT_PRIVATE_KEY: KEY,
  BOT_ENCRYPTION_SECRET_KEY: KEY,
  PULSECHAIN_REGISTRAR: ADDRESS,
  PULSECHAIN_HEX_REGISTRY: ADDRESS,
  PULSECHAIN_ORDER_FILLER: ADDRESS,
  PULSECHAIN_MIRROR_SYNC: ADDRESS,
  ETHEREUM_ORDER_BOOK: ADDRESS,
  ETHEREUM_MIRROR_REGISTRAR: ADDRESS,
};

test("mainnet is the default, with the live bridge and USDC bridged from Ethereum", () => {
  const config = loadConfig({ ...DEPLOYED });
  assert.equal(config.network, "mainnet");
  assert.equal(config.pulsechainRpcUrl, "https://rpc.pulsechain.com");
  assert.equal(config.homeAmb, "0x6ef79FD6f9f840264332884240539Ed7A2dA8b2b");
  assert.equal(config.foreignAmb, "0xd0764FAe29E0a6a96fF685f71CfC685456D5636c");
  assert.equal(config.pulsechainUsdc, "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07");
  assert.equal(CHAINS.mainnet.pulsechain.id, 369);
  assert.equal(CHAINS.mainnet.ethereum.id, 1);
});

test("the testnets use PulseChain Testnet v4, Sepolia and the testnet bridge", () => {
  const config = loadConfig({ ...DEPLOYED, NETWORK: "testnet", PULSECHAIN_USDC: ADDRESS });
  assert.equal(config.network, "testnet");
  assert.equal(config.pulsechainRpcUrl, "https://rpc.v4.testnet.pulsechain.com");
  assert.equal(config.ethereumRpcUrl, "https://ethereum-sepolia-rpc.publicnode.com");
  assert.equal(config.homeAmb, "0xf902DE27606cd3A7F66695c77487769Ff96211fE");
  assert.equal(config.foreignAmb, "0x67e190aaF39b9E05b162A78ab94189446077C694");
  assert.equal(CHAINS.testnet.pulsechain.id, 943);
  assert.equal(CHAINS.testnet.ethereum.id, 11155111);
});

test("on the testnets the bot sets its own tip, and viem uses it", async () => {
  const base = 7n; // PulseChain Testnet v4's base fee is a few wei
  const rpc = custom({
    async request({ method }: { method: string }) {
      if (method === "eth_getBlockByNumber") return { baseFeePerGas: `0x${base.toString(16)}` };
      if (method === "eth_maxPriorityFeePerGas") return `0x${parseGwei("3385").toString(16)}`; // what it suggests
      throw new Error(`unexpected ${method}`);
    },
  });
  const testnet = createPublicClient({ chain: CHAINS.testnet.pulsechain, transport: rpc });
  const fees = await testnet.estimateFeesPerGas();
  assert.equal(fees.maxPriorityFeePerGas, parseGwei("1"));
  assert.ok(fees.maxFeePerGas < parseGwei("2"));
  assert.equal(CHAINS.testnet.ethereum.fees.maxPriorityFeePerGas, parseGwei("0.01"));

  // Mainnet takes the chain's own suggestion.
  const live = createPublicClient({ chain: CHAINS.mainnet.pulsechain, transport: rpc });
  assert.equal((await live.estimateFeesPerGas()).maxPriorityFeePerGas, parseGwei("3385"));
});

test("on the testnets, USDC must come from step 1's summary", () => {
  assert.throws(() => loadConfig({ ...DEPLOYED, NETWORK: "testnet" }), /PULSECHAIN_USDC is not set/);
});

test("an unknown network is refused", () => {
  assert.throws(() => loadConfig({ ...DEPLOYED, NETWORK: "goerli" }), /NETWORK must be mainnet or testnet/);
});
