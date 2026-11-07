// The checkout preview must quote the tokens and routers the contracts are deployed with
// (script/Addresses.sol). On PulseChain that means USDC bridged from Ethereum, never the copy of
// USDC made when PulseChain forked from Ethereum, which wallets also call USDC.
import { describe, expect, it } from "vitest";

import addresses from "../../../script/Addresses.sol?raw";
import { PAY_CHAINS } from "./tokens";

function constantsOf(library: string): Record<string, string> {
  const body = addresses.split(`library ${library}`)[1].split("}")[0];
  const found = body.matchAll(/address internal constant (\w+) = (0x[0-9a-fA-F]{40});/g);
  return Object.fromEntries([...found].map((m) => [m[1], m[2].toLowerCase()]));
}

const pulsechain = constantsOf("PulseChainAddresses");
const ethereum = constantsOf("EthereumAddresses");
const lower = (address: string) => address.toLowerCase();
const pulsexRouters = [pulsechain.PULSEX_V1_ROUTER, pulsechain.PULSEX_V2_ROUTER];

describe("the checkout's tokens match the deployment", () => {
  it("pays in USDC bridged from Ethereum on PulseChain, and says so", () => {
    expect(pulsechain.USDC).toBe("0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07");
    for (const token of PAY_CHAINS.pulsechain.tokens) {
      if (token.path) expect(lower(token.path[token.path.length - 1])).toBe(pulsechain.USDC);
    }
    const usdc = PAY_CHAINS.pulsechain.tokens.find((token) => !token.path);
    expect(usdc?.label).toBe("USDC from Ethereum");
    expect(usdc?.note).toMatch(/bridged from Ethereum/);
  });

  it("never touches the copy of USDC made at PulseChain's fork", () => {
    const copy = ethereum.USDC; // the fork copied Ethereum's USDC contract to the same address
    for (const token of PAY_CHAINS.pulsechain.tokens) {
      for (const hop of token.path ?? []) expect(lower(hop)).not.toBe(copy);
    }
  });

  it("asks the same routers the checkout contracts swap on", () => {
    expect(pulsexRouters).toContain(lower(PAY_CHAINS.pulsechain.router));
    for (const token of PAY_CHAINS.pulsechain.tokens) {
      if (token.router) expect(pulsexRouters).toContain(lower(token.router));
      if (token.path) expect(lower(token.path[0])).not.toBe(pulsechain.USDC);
    }
    expect(lower(PAY_CHAINS.pulsechain.tokens[0].path![0])).toBe(pulsechain.WPLS);

    expect(lower(PAY_CHAINS.ethereum.router)).toBe(ethereum.UNISWAP_V2_ROUTER);
    for (const token of PAY_CHAINS.ethereum.tokens) {
      if (token.path) expect(lower(token.path[token.path.length - 1])).toBe(ethereum.USDC);
    }
    expect(lower(PAY_CHAINS.ethereum.tokens[0].path![0])).toBe(ethereum.WETH);
  });
});
