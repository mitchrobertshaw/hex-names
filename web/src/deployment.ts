// Where .hex is deployed, for the website and the app. Fill each network in from the deploy run
// summaries (deploy/README.md) and the bot's `npm run keygen`. Until a network is filled in, the
// homepage shows no live numbers and the app searches and prices names but can't buy them.

export type Network = "mainnet" | "testnet";
type Address = `0x${string}`;

export interface Deployment {
  /**
   * The day .hex launched on this network, as "YYYY-MM-DD". The referral launch offer (referrers
   * earn 10% of what the buyers they bring pay) runs for 58 days from it: src/lib/referral.ts.
   */
  launchDate?: string;
  pulsechain: {
    /** A PulseChain RPC that keeps the chain's whole history. */
    rpc: string;
    /** PULSECHAIN_HEX_REGISTRY: the .hex registry, where names live. */
    registry: Address;
    /** PULSECHAIN_REGISTRAR: takes commitments and sells names. */
    registrar: Address;
    /** AnyTokenCheckout: buys and renews with any token. */
    checkout: Address;
    /** PULSECHAIN_USDC: what names are priced and paid in. */
    usdc: Address;
    /** START_BLOCK_PULSECHAIN: the block step 1 was deployed in. */
    startBlock: number;
  };
  ethereum: {
    rpc: string;
    /** ETHEREUM_ORDER_BOOK: orders placed from Ethereum. */
    orderBook: Address;
    /** USDC on Ethereum (or Sepolia). */
    usdc: Address;
  };
  bot: {
    /** The public key from the bot's `npm run keygen`: orders are sealed to it. */
    publicKey: Address;
    /** The bot's least fee per order, in dollars (MIN_FEE_USDC). */
    minFee: number;
  };
}

export const DEPLOYMENTS: Record<Network, Deployment | null> = {
  mainnet: null,
  testnet: null,
};
