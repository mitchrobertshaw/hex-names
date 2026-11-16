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
    /** PULSECHAIN_CHECKOUT (AnyTokenCheckout): buys and renews with any token, and takes the Ethereum copy fee. */
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
  mainnet: {
    launchDate: "2026-11-16", // launch day: referrers earn 10% for the 58 days from it
    pulsechain: {
      rpc: "https://rpc.pulsechain.com",
      registry: "0xcD8cec12dab8D5770C5f2b0eE89899E70B6EB726", // PULSECHAIN_HEX_REGISTRY, from step 1
      registrar: "0x8ac071647e2DDd1B14a944D2bA38E3c8Cc268AA2", // PULSECHAIN_REGISTRAR, from step 1
      checkout: "0x69B739295463690fBf5aa038df1806bC11A34ff8", // PULSECHAIN_CHECKOUT, from step 1
      usdc: "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07", // USDC bridged from Ethereum (PULSECHAIN_USDC)
      startBlock: 28069588, // START_BLOCK_PULSECHAIN, from step 1
    },
    ethereum: {
      rpc: "https://ethereum-rpc.publicnode.com",
      orderBook: "0x6d7BA6aD41D0f1FC413AFaB88F09fF4920715dc9", // ETHEREUM_ORDER_BOOK, from step 2 (only for buying from Ethereum)
      usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
    },
    bot: {
      publicKey: "0xd5970cf368e5d9c33a8af02d0300ac7d4ed6254e35ba01587b9a9ac816504303", // from the production bot's log (only for buying from Ethereum)
      minFee: 0.25, // only for buying from Ethereum
      address: "0x30E9Ee0Fc693D41E9fE112c71fb85898CA95B555", // the production bot's wallet
    },
  },
  testnet: {
    launchDate: "2026-11-11", // the day you deployed on the testnets: the referral offer counts from it
    pulsechain: {
      rpc: "https://rpc.v4.testnet.pulsechain.com",
      registry: "0xac1bAac683b54219e3487BaEe083BCa9c33dA195", // PULSECHAIN_HEX_REGISTRY, from step 1
      registrar: "0xBb852D3549545Ec9c23c467e82CD707534Ce4F84", // PULSECHAIN_REGISTRAR, from step 1
      checkout: "0xb8a69Ac09cb7A022be1797aCc41A24ae96b0189c", // PULSECHAIN_CHECKOUT, from step 1
      usdc: "0x759CB81dEB2520f67F1074A4535e710aA9c3132B", // PULSECHAIN_USDC, from step 1
      startBlock: 25874420, // START_BLOCK_PULSECHAIN, from step 1: a number, without quotes
    },
    ethereum: {
      rpc: "https://ethereum-sepolia-rpc.publicnode.com",
      orderBook: "0x40a4B8Fb530e41F71aCd9e0e08a3F633a4Ac8C06", // ETHEREUM_ORDER_BOOK, from step 2 (only for buying from Ethereum)
      usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle's test USDC on Sepolia
    },
    bot: {
      publicKey: "0x04dbfd00ca7435d8cd93330105c880eed8b32fe1cd662593ee7f9452bb775212", // from the bot's log on Railway (only for buying from Ethereum)
      minFee: 0.25, // the bot's fee per order, in dollars (only for buying from Ethereum)
      address: "0xcD8ACE5f53A4efF15F82F16013Fd43ddEf9a8755", // the bot's wallet: the first 0x… in its log
    },
  },
};
