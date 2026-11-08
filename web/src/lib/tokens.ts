// The chains and tokens the checkout offers, with the routes the contracts swap along: PulseX on
// PulseChain (as AnyTokenCheckout and its fork tests use), Uniswap V2 on Ethereum (HexOrderBook).
import { ETHEREUM_ORDER_FEE } from "./names";

export type ChainKey = "pulsechain" | "ethereum";

export interface PayToken {
  symbol: string;
  /** What the page calls it, when the symbol alone could mean another token. */
  label?: string;
  /** Shown when it's picked. */
  note?: string;
  decimals: number;
  /** The chain's own coin (PLS or ETH), sent with the transaction rather than approved. */
  native?: boolean;
  /** The swap from this token to USDC, or null for USDC itself. */
  path: string[] | null;
  router?: string;
}

export interface PayChain {
  key: ChainKey;
  name: string;
  /** A public RPC that answers browsers, for live quotes. */
  rpc: string;
  router: string;
  dex: string;
  /** Dollars added to the price when paying from this chain. */
  fee: number;
  network: string;
  tokens: PayToken[];
}

const PULSECHAIN = {
  WPLS: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27",
  // USDC bridged from Ethereum ("USD Coin from Ethereum"): there's no native USDC on PulseChain yet.
  // Not the copy of USDC made when PulseChain forked from Ethereum, which wallets also call USDC.
  USDC: "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07",
  HEX: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
  PLSX: "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab",
  // Bridged from Ethereum by the official bridge (its bridgedTokenAddress), not the copies made at
  // PulseChain's fork.
  WETH_FROM_ETHEREUM: "0x02DcdD04e3F455D838cd1249292C58f3B79e3C3C",
  HEX_FROM_ETHEREUM: "0x57fde0a71132198BBeC939B98976993d8D89D225",
  PULSEX_V1: "0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02",
  PULSEX_V2: "0x165C3410fC91EF562C50559f7d2289fEbed552d9",
};

const ETHEREUM = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  HEX: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
  UNISWAP_V2: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
};

export const PAY_CHAINS: Record<ChainKey, PayChain> = {
  pulsechain: {
    key: "pulsechain",
    name: "PulseChain",
    rpc: "https://pulsechain-rpc.publicnode.com",
    router: PULSECHAIN.PULSEX_V2,
    dex: "PulseX",
    fee: 0,
    network: "A fraction of a cent, in PLS",
    tokens: [
      { symbol: "PLS", decimals: 18, native: true, path: [PULSECHAIN.WPLS, PULSECHAIN.USDC] },
      { symbol: "HEX", decimals: 8, path: [PULSECHAIN.HEX, PULSECHAIN.WPLS, PULSECHAIN.USDC], router: PULSECHAIN.PULSEX_V1 },
      {
        symbol: "eHEX",
        note: "HEX bridged from Ethereum, which your wallet calls \u201cHEX from Ethereum\u201d. Not the HEX made on PulseChain.",
        decimals: 8,
        path: [PULSECHAIN.HEX_FROM_ETHEREUM, PULSECHAIN.WPLS, PULSECHAIN.USDC],
        router: PULSECHAIN.PULSEX_V2,
      },
      { symbol: "PLSX", decimals: 18, path: [PULSECHAIN.PLSX, PULSECHAIN.WPLS, PULSECHAIN.USDC], router: PULSECHAIN.PULSEX_V1 },
      {
        symbol: "USDC",
        label: "USDC from Ethereum",
        note: "USDC bridged from Ethereum, which your wallet calls \u201cUSD Coin from Ethereum\u201d. There\u2019s no native USDC on PulseChain yet, and the USDC copied when PulseChain launched is a different token.",
        decimals: 6,
        path: null,
      },
      // Through WPLS, on the PulseX router with the deeper pools for each (checked on 8 November
      // 2026: WETH lost 0.1% on $100 and eHEX 1% on $100, about 7% on $640).
      {
        symbol: "WETH",
        label: "WETH from Ethereum",
        note: "Ether bridged from Ethereum, which your wallet calls \u201cWrapped Ether from Ethereum\u201d.",
        decimals: 18,
        path: [PULSECHAIN.WETH_FROM_ETHEREUM, PULSECHAIN.WPLS, PULSECHAIN.USDC],
        router: PULSECHAIN.PULSEX_V1,
      },
    ],
  },
  ethereum: {
    key: "ethereum",
    name: "Ethereum",
    rpc: "https://ethereum-rpc.publicnode.com",
    router: ETHEREUM.UNISWAP_V2,
    dex: "Uniswap",
    fee: ETHEREUM_ORDER_FEE,
    network: "Set by Ethereum; your wallet shows it before you confirm",
    tokens: [
      { symbol: "ETH", decimals: 18, native: true, path: [ETHEREUM.WETH, ETHEREUM.USDC] },
      { symbol: "USDC", decimals: 6, path: null },
      { symbol: "HEX", decimals: 8, path: [ETHEREUM.HEX, ETHEREUM.WETH, ETHEREUM.USDC] },
    ],
  },
};

// The testnets (script/Addresses.sol): PulseChain Testnet v4, and Sepolia joined to it by the testnet
// bridge. On PulseChain Testnet v4 names are paid for in USDC bridged from Sepolia; PulseX's testnet
// has no pool for it, so that is the only way to pay there.
const SEPOLIA = {
  WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
  USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  UNISWAP_V2: "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3",
};

export const TESTNET_PAY_CHAINS: Record<ChainKey, PayChain> = {
  pulsechain: {
    key: "pulsechain",
    name: "PulseChain Testnet v4",
    rpc: "https://rpc.v4.testnet.pulsechain.com",
    router: "0x636f6407B90661b73b1C0F7e24F4C79f624d0738",
    dex: "PulseX",
    fee: 0,
    network: "A fraction of a cent, in tPLS",
    tokens: [
      {
        symbol: "USDC",
        label: "USDC from Sepolia",
        note: "Circle\u2019s test USDC, bridged from Sepolia by the testnet bridge.",
        decimals: 6,
        path: null,
      },
    ],
  },
  ethereum: {
    key: "ethereum",
    name: "Sepolia",
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    router: SEPOLIA.UNISWAP_V2,
    dex: "Uniswap",
    fee: ETHEREUM_ORDER_FEE,
    network: "Close to nothing, in Sepolia ETH",
    tokens: [
      { symbol: "ETH", decimals: 18, native: true, path: [SEPOLIA.WETH, SEPOLIA.USDC] },
      { symbol: "USDC", decimals: 6, path: null },
    ],
  },
};
