// The chains and tokens the checkout offers, with the routes the contracts swap along: PulseX on
// PulseChain (as AnyTokenCheckout and its fork tests use), Uniswap V2 on Ethereum (HexOrderBook).
import { ETHEREUM_ORDER_FEE } from "./names";

export type ChainKey = "pulsechain" | "ethereum";

export interface PayToken {
  symbol: string;
  decimals: number;
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
  USDC: "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07", // USDC bridged from Ethereum
  HEX: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
  PLSX: "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab",
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
      { symbol: "PLS", decimals: 18, path: [PULSECHAIN.WPLS, PULSECHAIN.USDC] },
      { symbol: "HEX", decimals: 8, path: [PULSECHAIN.HEX, PULSECHAIN.WPLS, PULSECHAIN.USDC], router: PULSECHAIN.PULSEX_V1 },
      { symbol: "PLSX", decimals: 18, path: [PULSECHAIN.PLSX, PULSECHAIN.WPLS, PULSECHAIN.USDC], router: PULSECHAIN.PULSEX_V1 },
      { symbol: "USDC", decimals: 6, path: null },
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
      { symbol: "ETH", decimals: 18, path: [ETHEREUM.WETH, ETHEREUM.USDC] },
      { symbol: "USDC", decimals: 6, path: null },
      { symbol: "HEX", decimals: 8, path: [ETHEREUM.HEX, ETHEREUM.WETH, ETHEREUM.USDC] },
    ],
  },
};
