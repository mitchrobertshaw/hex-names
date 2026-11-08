// What the bot remembers between runs, kept in one JSON file.

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import type { Hex } from "viem";

export type OrderStatus =
  | "new" // seen on Ethereum, not yet acted on
  | "committed" // commitment made on PulseChain, waiting for it to age
  | "filled" // registered on PulseChain; payment follows over the bridge
  | "refunded" // reported unfillable or expired; refund follows over the bridge
  | "waiting-for-deadline" // the bot will not fill it (unreadable, underpaid, ...); refunded once its deadline passes
  | "closed"; // settled on Ethereum by someone else

export type OrderRecord = {
  orderId: string;
  commitment: Hex;
  deadline: string; // unix seconds
  amount: string; // USDC units
  sealed: Hex;
  status: OrderStatus;
  note?: string;
  committedAt?: string; // unix seconds
  price?: string; // USDC units the name costs, once the bot has committed to fill it
  txs: Hex[];
  advanced?: string; // USDC units the bot paid for the name, when it filled the order itself
  repaid?: boolean; // the order has paid the bot back on Ethereum
};

export type MessageRecord = {
  messageId: Hex;
  encoded: Hex;
  hash: Hex;
  gasLimit: string;
  sender: string;
  seenAtBlock: string;
  status: "waiting" | "claimed" | "claimed-by-someone-else" | "skipped";
  note?: string; // why it was skipped
  tx?: Hex;
  own?: { usdc: string }; // the bot's own USDC, sent to Ethereum over the bridge to buy ETH
};

/** USDC the bot sent home from Ethereum over the bridge, until it arrives on PulseChain. */
export type HomeTransfer = { messageId: Hex; usdc: string; tx: Hex; sentAt: string; arrived?: boolean };

export type TreasuryState = {
  lastRun?: string; // unix seconds
  lastReport?: string; // unix seconds: the daily line about its balances
  home: HomeTransfer[];
  warned: Record<string, string>; // what it last warned about, and when (unix seconds)
};

export type State = {
  ethereumBlock: string; // last Ethereum block scanned for orders
  pulsechainAmbBlock: string; // last PulseChain block scanned for bridge messages
  pulsechainRegistryBlock: string; // last PulseChain block scanned for name changes
  orders: Record<string, OrderRecord>;
  messages: Record<string, MessageRecord>;
  treasury?: TreasuryState;
};

export function loadState(file: string): State | undefined {
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, "utf8")) as State;
}

/** Writes the state atomically, so a crash never leaves a half-written file. */
export function saveState(file: string, state: State): void {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, file);
}
