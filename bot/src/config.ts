// Settings, from environment variables. See bot/.env.example.

import { type Address, type Hex, getAddress, isHex } from "viem";

export type Config = {
  pulsechainRpcUrl: string;
  ethereumRpcUrl: string;
  botPrivateKey: Hex; // the bot's wallet, the same address on both chains
  encryptionSecretKey: Hex; // opens the sealed order details; keep it secret
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
  stateFile: string;
  startBlockEthereum: bigint | undefined;
  startBlockPulseChain: bigint | undefined;
  fill: boolean; // fill Ethereum orders
  relay: boolean; // claim bridge messages on Ethereum
  sync: boolean; // copy name changes to Ethereum
};

const DEFAULT_PULSECHAIN_USDC = "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07"; // USDC bridged from Ethereum
const DEFAULT_HOME_AMB = "0x6ef79FD6f9f840264332884240539Ed7A2dA8b2b";
const DEFAULT_FOREIGN_AMB = "0xd0764FAe29E0a6a96fF685f71CfC685456D5636c";

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

  return {
    pulsechainRpcUrl: optional("PULSECHAIN_RPC_URL") ?? "https://rpc.pulsechain.com",
    ethereumRpcUrl: optional("ETHEREUM_RPC_URL") ?? "https://ethereum-rpc.publicnode.com",
    botPrivateKey: key("BOT_PRIVATE_KEY"),
    encryptionSecretKey: key("BOT_ENCRYPTION_SECRET_KEY"),
    payee: optional("PAYEE") ? getAddress(optional("PAYEE")!) : undefined,
    registrar: address("PULSECHAIN_REGISTRAR"),
    hexRegistry: address("PULSECHAIN_HEX_REGISTRY"),
    orderFiller: address("PULSECHAIN_ORDER_FILLER"),
    mirrorSync: address("PULSECHAIN_MIRROR_SYNC"),
    pulsechainUsdc: address("PULSECHAIN_USDC", DEFAULT_PULSECHAIN_USDC),
    homeAmb: address("PULSECHAIN_AMB", DEFAULT_HOME_AMB),
    orderBook: address("ETHEREUM_ORDER_BOOK"),
    mirrorRegistrar: address("ETHEREUM_MIRROR_REGISTRAR"),
    foreignAmb: address("ETHEREUM_AMB", DEFAULT_FOREIGN_AMB),
    minFee: usdc(optional("MIN_FEE_USDC") ?? "0.25"),
    ethereumConfirmations: BigInt(optional("ETHEREUM_CONFIRMATIONS") ?? "2"),
    pollSeconds: Number(optional("POLL_SECONDS") ?? "5"),
    stateFile: optional("STATE_FILE") ?? "./state.json",
    startBlockEthereum: block("START_BLOCK_ETHEREUM"),
    startBlockPulseChain: block("START_BLOCK_PULSECHAIN"),
    fill: flag("FILL"),
    relay: flag("RELAY"),
    sync: flag("SYNC"),
  };
}
