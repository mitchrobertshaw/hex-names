// The network this build of the app works on (VITE_NETWORK), its deployment, and how to reach it.

import { type Chain, type PublicClient, createPublicClient, http } from "viem";
import { mainnet, pulsechain, pulsechainV4, sepolia } from "viem/chains";

import { DEPLOYMENTS, type Deployment } from "../deployment";
import { type ChainKey, PAY_CHAINS, type PayChain, TESTNET_PAY_CHAINS } from "../lib/tokens";
import { NETWORK } from "../site";

export const network = NETWORK;

/** The contracts, once deployed. Until then the app searches and prices names but can't buy them. */
export const deployment: Deployment | null = DEPLOYMENTS[NETWORK];

export const CHAINS: Record<ChainKey, Chain> =
  NETWORK === "testnet" ? { pulsechain: pulsechainV4, ethereum: sepolia } : { pulsechain, ethereum: mainnet };

/** What each chain's checkout offers to pay with. */
export const PAY: Record<ChainKey, PayChain> = NETWORK === "testnet" ? TESTNET_PAY_CHAINS : PAY_CHAINS;

const rpcOf = (key: ChainKey) => deployment?.[key].rpc ?? PAY[key].rpc;

/** For reading the chains, whatever wallet is connected. */
export const clients: Record<ChainKey, PublicClient> = {
  pulsechain: createPublicClient({ chain: CHAINS.pulsechain, transport: http(rpcOf("pulsechain")) }) as PublicClient,
  ethereum: createPublicClient({ chain: CHAINS.ethereum, transport: http(rpcOf("ethereum")) }) as PublicClient,
};

/** A transaction on the chain's explorer. */
export function txUrl(key: ChainKey, hash: string): string {
  return `${CHAINS[key].blockExplorers?.default.url}/tx/${hash}`;
}

export function addressUrl(key: ChainKey, address: string): string {
  return `${CHAINS[key].blockExplorers?.default.url}/address/${address}`;
}

/** What wallets need to add a chain they don't know, PulseChain's testnet especially. */
export function addChainParams(key: ChainKey) {
  const chain = CHAINS[key];
  return {
    chainId: `0x${chain.id.toString(16)}`,
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: [rpcOf(key)],
    blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : [],
  };
}
