// Where .hex is deployed, for the website and the app. Fill each network in from the deploy run
// summaries and the public key the bot prints when it starts: deploy/website/README.md has a block
// to paste for each. Until a network is filled in, the homepage shows no live numbers and the app
// searches and prices names but can't buy them.

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
    /** ETHEREUM_ORDER_BOOK: orders placed from Ethereum. Only for buying from Ethereum, which is switched off. */
    orderBook: Address;
    /** USDC on Ethereum (or Sepolia). */
    usdc: Address;
  };
  bot: {
    /**
     * The public key the bot prints when it starts ("for the website"): orders from Ethereum are sealed
     * to it. Only for buying from Ethereum, which is switched off; kept ready in case that changes.
     */
    publicKey: Address;
    /** The bot's least fee per order from Ethereum, in dollars (MIN_FEE_USDC). Only for buying from Ethereum. */
    minFee: number;
    /**
     * The bot's wallet, the address it prints when it starts ("hex-names bot 0x…"). The payments
     * page shows its balances, and the budget the payments wallet allows it.
     */
    address?: Address;
  };
}

export const DEPLOYMENTS: Record<Network, Deployment | null> = {
  mainnet: null,
  testnet: null,
};
