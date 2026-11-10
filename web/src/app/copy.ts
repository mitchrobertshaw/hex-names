// The Ethereum copy fee. Each name has a copy on Ethereum, written there by the project's bot, which
// pays Ethereum's gas for it. While a copy costs up to $2 there's no fee, and copies follow by
// themselves in about 15 minutes. When Ethereum is busy, the bot sets a copy fee on the checkout for
// the rest: anyone buying, renewing or sending a name can pay it to have it copied at once, or leave
// it to be copied free once Ethereum's fees fall. The admin caps the fee: above the cap, copying at
// once isn't offered, and copies wait.

import { useEffect, useState } from "react";
import { type Address, getAbiItem, isAddressEqual, parseEventLogs, type TransactionReceipt } from "viem";

import { checkoutAbi, mirrorRegistrarAbi, mirrorSyncAbi, registryAbi } from "./abis";
import { clients, deployment } from "./network";
import { labelId } from "./order";

export type CopyFee =
  /** Nothing to pay: copies follow by themselves. Ethereum isn't busy, or the fee is off. */
  | { kind: "free" }
  /** `fee` (USDC units) copies a name at once; without it, it's copied free once Ethereum's fees fall. */
  | { kind: "offered"; fee: bigint }
  /** Ethereum is so busy a copy would cost more than the admin's cap (USDC units): copies wait for its fees to fall. */
  | { kind: "busy"; cap: bigint };

/** The copy fee, from the checkout's fee and the admin's cap. */
export function copyFeeOf(fee: bigint, cap: bigint): CopyFee {
  if (fee === 0n || cap === 0n) return { kind: "free" };
  return fee > cap ? { kind: "busy", cap } : { kind: "offered", fee };
}

/** The copy fee now. Free if the checkout can't say: one deployed before the copy fee has none. */
export async function readCopyFee(): Promise<CopyFee> {
  const d = deployment;
  if (!d) return { kind: "free" };
  const checkout = { address: d.pulsechain.checkout, abi: checkoutAbi } as const;
  try {
    const [fee, cap] = await Promise.all([
      clients.pulsechain.readContract({ ...checkout, functionName: "copyFee" }),
      clients.pulsechain.readContract({ ...checkout, functionName: "maxCopyFee" }),
    ]);
    return copyFeeOf(fee, cap);
  } catch {
    return { kind: "free" };
  }
}

/** The copy fee, read again every minute: null until it's known. */
export function useCopyFee(): CopyFee | null {
  const [fee, setFee] = useState<CopyFee | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () => readCopyFee().then((value) => alive && setFee(value));
    void read();
    const timer = setInterval(read, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return fee;
}

/** The copy fee a payment paid, from its receipt: 0 if it paid none. */
export function copyFeePaid(receipt: Pick<TransactionReceipt, "logs">): bigint {
  const checkout = deployment?.pulsechain.checkout;
  if (!checkout) return 0n;
  return parseEventLogs({ abi: checkoutAbi, eventName: "CopyPaid", logs: receipt.logs })
    .filter((log) => isAddressEqual(log.address, checkout))
    .reduce((sum, log) => sum + log.args.fee, 0n);
}

/** Dollars, for the page: "$1.25". */
export function feeText(fee: bigint): string {
  return `$${(Number(fee) / 1e6).toFixed(2)}`;
}

/** Dollars, without cents when there are none: "$100", "$12.50". */
export function capText(cap: bigint): string {
  return cap % 1_000_000n === 0n ? `$${(cap / 1_000_000n).toLocaleString("en-US")}` : feeText(cap);
}

/** What the project pays of each copy, above which there's a fee (the bot's COPY_FREE_USDC). */
export const FREE_COPY = "$2";

let ethereumRegistry: Promise<Address> | null = null;

/**
 * The .hex registry on Ethereum, found from the contracts: the checkout's HexMirrorSync, its partner
 * on Ethereum (HexMirrorRegistrar), and the registry that one writes copies into.
 */
function ethereumRegistryAddress(): Promise<Address> {
  const d = deployment;
  if (!d) return Promise.reject(new Error("The contracts aren't deployed yet."));
  ethereumRegistry ??= clients.pulsechain
    .readContract({ address: d.pulsechain.checkout, abi: checkoutAbi, functionName: "MIRROR_SYNC" })
    .then((sync) => clients.pulsechain.readContract({ address: sync, abi: mirrorSyncAbi, functionName: "peer" }))
    .then((mirror) => clients.ethereum.readContract({ address: mirror, abi: mirrorRegistrarAbi, functionName: "REGISTRY" }))
    .catch((error) => {
      ethereumRegistry = null;
      throw error;
    });
  return ethereumRegistry;
}

/**
 * Whether Ethereum's copy of a name shows its owner and paid-until date as PulseChain does: the
 * same, behind, or behind with its copy fee paid (the bot copies it at once).
 */
export type EthereumCopy = "same" | "behind" | "paid" | "unknown";

/** About 8 hours of PulseChain's blocks: far longer than a paid copy takes to go across. */
const RECENT_BLOCKS = 3_000n;

/** Whether someone paid the copy fee for `label` lately. */
async function paidLately(label: string): Promise<boolean> {
  const checkout = deployment?.pulsechain.checkout;
  if (!checkout) return false;
  const latest = await clients.pulsechain.getBlockNumber();
  const logs = await clients.pulsechain.getLogs({
    address: checkout,
    event: getAbiItem({ abi: checkoutAbi, name: "CopyPaid" }),
    fromBlock: latest > RECENT_BLOCKS ? latest - RECENT_BLOCKS : 0n,
    toBlock: latest,
  });
  return logs.some((log) => log.args.label === label);
}

export async function readEthereumCopy(label: string, owner: Address, expiry: number): Promise<EthereumCopy> {
  try {
    const state = await clients.ethereum.readContract({
      address: await ethereumRegistryAddress(),
      abi: registryAbi,
      functionName: "getState",
      args: [labelId(label)],
    });
    if (isAddressEqual(state.latestOwner, owner) && Number(state.expiry) === expiry) return "same";
    return (await paidLately(label).catch(() => false)) ? "paid" : "behind";
  } catch {
    return "unknown";
  }
}

/** Ethereum's copy of a name, read again every 30 seconds until it's up to date: null until it's known. */
export function useEthereumCopy(label: string, owner: Address | null, expiry: number, version: number): EthereumCopy | null {
  const [copy, setCopy] = useState<EthereumCopy | null>(null);
  useEffect(() => {
    setCopy(null);
    if (!deployment || !owner) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      const result = await readEthereumCopy(label, owner, expiry);
      if (!alive) return;
      setCopy(result);
      if (result === "behind" || result === "paid") timer = setTimeout(read, 30_000);
    };
    void read();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [label, owner, expiry, version]);
  return copy;
}
