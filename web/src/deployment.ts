// Where .hex is deployed, for the website. Fill each network in from the deploy run summaries
// (deploy/README.md): PULSECHAIN_HEX_REGISTRY and START_BLOCK_PULSECHAIN from step 1.
// Until a network is filled in, the site shows no live numbers for it.

export type Network = "mainnet" | "testnet";

export interface Deployment {
  /** A PulseChain RPC that keeps the chain's whole history. */
  rpc: string;
  /** PULSECHAIN_HEX_REGISTRY: the .hex registry, where names live. */
  registry: `0x${string}`;
  /** START_BLOCK_PULSECHAIN: the block step 1 was deployed in. */
  startBlock: number;
}

export const DEPLOYMENTS: Record<Network, Deployment | null> = {
  // { rpc: "https://rpc.pulsechain.com", registry: "0x…", startBlock: … }
  mainnet: null,
  // { rpc: "https://rpc.v4.testnet.pulsechain.com", registry: "0x…", startBlock: … }
  testnet: null,
};
