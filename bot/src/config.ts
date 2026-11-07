// Settings, from environment variables. See bot/.env.example.

import { join } from "node:path";

import { type Address, type Hex, getAddress, isHex } from "viem";

import { encryptionSecretKeyFrom } from "./reveal.ts";

/** Mainnet (PulseChain + Ethereum), or the testnets (PulseChain Testnet v4 + Sepolia). */
export type Network = "mainnet" | "testnet";

export type Config = {
  network: Network;
  pulsechainRpcUrl: string;
  ethereumRpcUrl: string;
  botPrivateKey: Hex; // the bot's wallet, the same address on both chains
  encryptionSecretKey: Hex; // opens the sealed order details; keep it secret
  encryptionKeyFromWallet: boolean; // true if made from the wallet key (BOT_ENCRYPTION_SECRET_KEY not set)
  payee: Address | undefined; // who HexOrderBook pays on Ethereum; defaults to the bot's wallet

  // PulseChain (from deploy step 1)
  registrar: Address;
  hexRegistry: Address;
  orderFiller: Address;
  mirrorSync: Address;
  pulsechainUsdc: Address;
  homeAmb: Address;

  // Ethereum (from deploy step 2)
  orderBook: Address;
  mirrorRegistrar: Address;
  foreignAmb: Address;

  minFee: bigint; // least fee per order, in USDC units (6 decimals)
  ethereumConfirmations: bigint; // Ethereum blocks to wait before acting on an order
  pollSeconds: number;
  stateFile: string; // where it remembers its place: STATE_FILE, else on a Railway volume, else ./state.json
  railway: { volume: string | undefined } | undefined; // set when running on Railway
  startBlockEthereum: bigint | undefined;
  startBlockPulseChain: bigint | undefined;
  fill: boolean; // fill Ethereum orders
  relay: boolean; // claim bridge messages on Ethereum
  sync: boolean; // copy name changes to Ethereum
};

/** What each network uses unless the .env says otherwise (the same addresses as script/Addresses.sol). */
export const NETWORK_DEFAULTS: Record<
  Network,
  { pulsechainRpcUrl: string; ethereumRpcUrl: string; homeAmb: string; foreignAmb: string; pulsechainUsdc?: string }
> = {
  mainnet: {
    pulsechainRpcUrl: "https://rpc.pulsechain.com",
    ethereumRpcUrl: "https://ethereum-rpc.publicnode.com",
    homeAmb: "0x6ef79FD6f9f840264332884240539Ed7A2dA8b2b",
    foreignAmb: "0xd0764FAe29E0a6a96fF685f71CfC685456D5636c",
    pulsechainUsdc: "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07", // USDC bridged from Ethereum
  },
  testnet: {
    pulsechainRpcUrl: "https://rpc.v4.testnet.pulsechain.com",
    ethereumRpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    homeAmb: "0xf902DE27606cd3A7F66695c77487769Ff96211fE",
    foreignAmb: "0x67e190aaF39b9E05b162A78ab94189446077C694",
    // No default: "USDC from Sepolia" exists once someone bridges it. Step 1 prints it as PULSECHAIN_USDC.
  },
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`${name} is not set (see bot/.env.example)`);
    return value;
  };
  const optional = (name: string): string | undefined => env[name]?.trim() || undefined;
  const address = (name: string, fallback?: string): Address => getAddress(optional(name) ?? fallback ?? required(name));
  const key = (name: string): Hex => {
    const value = required(name);
    const hex = (value.startsWith("0x") ? value : `0x${value}`) as Hex;
    if (!isHex(hex) || hex.length !== 66) throw new Error(`${name} must be 32 bytes of hex`);
    return hex;
  };
  const flag = (name: string): boolean => (optional(name) ?? "true").toLowerCase() !== "false";
  const block = (name: string): bigint | undefined => {
    const value = optional(name);
    return value === undefined ? undefined : BigInt(value);
  };
  const usdc = (value: string): bigint => {
    const [whole = "0", fraction = ""] = value.split(".");
    return BigInt(whole) * 1_000_000n + BigInt((fraction + "000000").slice(0, 6));
  };

  const networkName = (optional("NETWORK") ?? "mainnet").toLowerCase();
  if (networkName !== "mainnet" && networkName !== "testnet") throw new Error("NETWORK must be mainnet or testnet");
  const network: Network = networkName;
  const defaults = NETWORK_DEFAULTS[network];

  const botPrivateKey = key("BOT_PRIVATE_KEY");
  const ownEncryptionKey = optional("BOT_ENCRYPTION_SECRET_KEY") !== undefined;
  // Railway sets its RAILWAY_ variables in every deployment, and RAILWAY_VOLUME_MOUNT_PATH when a
  // volume is attached: the bot keeps its state there, so it survives restarts and redeploys.
  const onRailway = ["RAILWAY_PROJECT_ID", "RAILWAY_SERVICE_ID", "RAILWAY_ENVIRONMENT_ID", "RAILWAY_ENVIRONMENT_NAME"].some(
    (name) => optional(name) !== undefined,
  );
  const railway = onRailway ? { volume: optional("RAILWAY_VOLUME_MOUNT_PATH") } : undefined;

  return {
    network,
    pulsechainRpcUrl: optional("PULSECHAIN_RPC_URL") ?? defaults.pulsechainRpcUrl,
    ethereumRpcUrl: optional("ETHEREUM_RPC_URL") ?? defaults.ethereumRpcUrl,
    botPrivateKey,
    encryptionSecretKey: ownEncryptionKey ? key("BOT_ENCRYPTION_SECRET_KEY") : encryptionSecretKeyFrom(botPrivateKey),
    encryptionKeyFromWallet: !ownEncryptionKey,
    payee: optional("PAYEE") ? getAddress(optional("PAYEE")!) : undefined,
    registrar: address("PULSECHAIN_REGISTRAR"),
    hexRegistry: address("PULSECHAIN_HEX_REGISTRY"),
    orderFiller: address("PULSECHAIN_ORDER_FILLER"),
    mirrorSync: address("PULSECHAIN_MIRROR_SYNC"),
    pulsechainUsdc: address("PULSECHAIN_USDC", defaults.pulsechainUsdc),
    homeAmb: address("PULSECHAIN_AMB", defaults.homeAmb),
    orderBook: address("ETHEREUM_ORDER_BOOK"),
    mirrorRegistrar: address("ETHEREUM_MIRROR_REGISTRAR"),
    foreignAmb: address("ETHEREUM_AMB", defaults.foreignAmb),
    minFee: usdc(optional("MIN_FEE_USDC") ?? "0.25"),
    ethereumConfirmations: BigInt(optional("ETHEREUM_CONFIRMATIONS") ?? "2"),
    pollSeconds: Number(optional("POLL_SECONDS") ?? "5"),
    stateFile: optional("STATE_FILE") ?? (railway?.volume ? join(railway.volume, "state.json") : "./state.json"),
    railway,
    startBlockEthereum: block("START_BLOCK_ETHEREUM"),
    startBlockPulseChain: block("START_BLOCK_PULSECHAIN"),
    fill: flag("FILL"),
    relay: flag("RELAY"),
    sync: flag("SYNC"),
  };
}
