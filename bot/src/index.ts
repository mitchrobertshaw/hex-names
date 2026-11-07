// The .hex bot. Run with: npm start (settings in .env or the environment; see .env.example).

import { loadConfig } from "./config.ts";
import { createContext } from "./context.ts";
import { processOrders, scanOrders, short } from "./orders.ts";
import { claimMessages, scanMessages } from "./relay.ts";
import { type State, loadState, saveState } from "./state.ts";
import { syncNames } from "./sync.ts";

const config = loadConfig();

let state = loadState(config.stateFile);
if (!state) {
  const ctx = createContext(config, {} as State);
  const [eth, pls] = await Promise.all([ctx.eth.getBlockNumber(), ctx.pls.getBlockNumber()]);
  state = {
    ethereumBlock: ((config.startBlockEthereum ?? eth) - 1n).toString(),
    pulsechainAmbBlock: ((config.startBlockPulseChain ?? pls) - 1n).toString(),
    pulsechainRegistryBlock: ((config.startBlockPulseChain ?? pls) - 1n).toString(),
    orders: {},
    messages: {},
  };
}
const ctx = createContext(config, state);

ctx.log(`hex-names bot ${ctx.account.address} on ${config.network === "testnet" ? "the testnets (PulseChain Testnet v4 + Sepolia)" : "mainnet (PulseChain + Ethereum)"}`);
ctx.log(`  pays out to ${ctx.payee} on Ethereum`);
ctx.log(`  order encryption public key (publish this for websites): ${ctx.encryption.publicKey}`);
ctx.log(`  fill orders: ${config.fill}, claim bridge messages: ${config.relay}, copy name changes: ${config.sync}`);

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
    ctx.log(`${signal}: saving and stopping`);
  });
}

async function step(name: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    ctx.log(`${name}: ${short(error)} (will retry)`);
  }
}

while (!stopping) {
  if (config.fill) {
    await step("orders", async () => {
      await scanOrders(ctx);
      await processOrders(ctx);
    });
  }
  if (config.relay) {
    await step("bridge", async () => {
      await scanMessages(ctx);
      await claimMessages(ctx);
    });
  }
  if (config.sync) await step("sync", () => syncNames(ctx));
  saveState(config.stateFile, state);
  for (let waited = 0; waited < config.pollSeconds * 10 && !stopping; waited++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
saveState(config.stateFile, state);
