// Connecting a wallet: every browser wallet that announces itself (EIP-6963: MetaMask, Rabby,
// Internet Money and others), or the one at window.ethereum. The app asks the wallet to sign; it
// never sees a key.

import { useSyncExternalStore } from "react";
import {
  type Account,
  type Address,
  type Chain,
  type Transport,
  type WalletClient,
  createWalletClient,
  custom,
  getAddress,
} from "viem";

import { addChainParams, CHAINS } from "./network";
import type { ChainKey } from "../lib/tokens";

export interface Eip1193 {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
}

export interface WalletOption {
  id: string; // rdns, e.g. io.metamask
  name: string;
  icon?: string;
  provider: Eip1193;
}

export interface WalletState {
  options: WalletOption[];
  connected: { option: WalletOption; account: Address; chainId: number } | null;
  connecting: boolean;
  error: string | null;
}

const LAST = "hexns-wallet";
let state: WalletState = { options: [], connected: null, connecting: false, error: null };
const listeners = new Set<() => void>();

function set(next: Partial<WalletState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function remember(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST, id);
    else localStorage.removeItem(LAST);
  } catch {
    // Private windows: nothing to remember.
  }
}

function recalled(): string | null {
  try {
    return localStorage.getItem(LAST);
  } catch {
    return null;
  }
}

let started = false;
/** Listens for wallets announcing themselves, and reconnects the last one used, quietly. */
function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("eip6963:announceProvider", ((event: CustomEvent) => {
    const { info, provider } = event.detail as {
      info: { rdns: string; name: string; icon: string };
      provider: Eip1193;
    };
    if (state.options.some((o) => o.id === info.rdns)) return;
    set({ options: [...state.options, { id: info.rdns, name: info.name, icon: info.icon, provider }] });
    if (!state.connected && recalled() === info.rdns) void connect(info.rdns, true);
  }) as EventListener);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  // Older wallets don't announce themselves.
  setTimeout(() => {
    const injected = (window as unknown as { ethereum?: Eip1193 }).ethereum;
    if (injected && state.options.length === 0) {
      set({ options: [{ id: "injected", name: "Browser wallet", provider: injected }] });
      if (!state.connected && recalled() === "injected") void connect("injected", true);
    }
  }, 400);
}

let unsubscribe: (() => void) | null = null;

/** Connects a wallet. Quietly (no pop-up) when reconnecting one used before. */
export async function connect(id: string, quietly = false): Promise<void> {
  const option = state.options.find((o) => o.id === id);
  if (!option) return;
  set({ connecting: !quietly, error: null });
  try {
    const accounts = (await option.provider.request({
      method: quietly ? "eth_accounts" : "eth_requestAccounts",
    })) as string[];
    if (!accounts.length) {
      set({ connecting: false });
      return;
    }
    const chainId = Number(await option.provider.request({ method: "eth_chainId" }));
    unsubscribe?.();
    const onAccounts = (list: string[]) =>
      list.length ? set({ connected: { ...state.connected!, account: getAddress(list[0]) } }) : disconnect();
    const onChain = (hex: string) =>
      state.connected && set({ connected: { ...state.connected, chainId: Number(hex) } });
    option.provider.on?.("accountsChanged", onAccounts as never);
    option.provider.on?.("chainChanged", onChain as never);
    unsubscribe = () => {
      option.provider.removeListener?.("accountsChanged", onAccounts as never);
      option.provider.removeListener?.("chainChanged", onChain as never);
    };
    set({ connected: { option, account: getAddress(accounts[0]), chainId }, connecting: false });
    remember(id);
  } catch (error) {
    set({ connecting: false, error: quietly ? null : messageOf(error) });
  }
}

export function disconnect() {
  unsubscribe?.();
  unsubscribe = null;
  remember(null);
  set({ connected: null });
}

/** Asks the wallet to move to PulseChain or Ethereum (adding it first if it doesn't know it). */
export async function switchTo(key: ChainKey): Promise<void> {
  const connected = state.connected;
  if (!connected) throw new Error("Connect a wallet first.");
  const chain = CHAINS[key];
  if (connected.chainId === chain.id) return;
  const chainId = `0x${chain.id.toString(16)}`;
  try {
    await connected.option.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await connected.option.provider.request({ method: "wallet_addEthereumChain", params: [addChainParams(key)] });
  }
  set({ connected: { ...connected, chainId: chain.id } });
}

/** A client that asks the connected wallet to sign on `key`'s chain. */
export function walletClient(key: ChainKey): WalletClient<Transport, Chain, Account> {
  const connected = state.connected;
  if (!connected) throw new Error("Connect a wallet first.");
  return createWalletClient({
    account: connected.account,
    chain: CHAINS[key],
    transport: custom(connected.option.provider),
  });
}

export function useWallet(): WalletState {
  return useSyncExternalStore(
    (listener) => {
      start();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
  );
}

/** A wallet's error, said plainly. */
export function messageOf(error: unknown): string {
  const e = error as { code?: number; shortMessage?: string; message?: string; cause?: { code?: number } };
  if (e?.code === 4001 || e?.cause?.code === 4001 || /user (rejected|denied)/i.test(e?.message ?? "")) {
    return "You cancelled it in your wallet.";
  }
  return e?.shortMessage ?? e?.message ?? "Something went wrong.";
}

export const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
