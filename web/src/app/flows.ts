// Buying, renewing and sending names: each a few wallet steps, reported as they go.

import { type Address, type ContractFunctionArgs, type Hex, zeroAddress } from "viem";

import type { ChainKey, PayToken } from "../lib/tokens";
import { checkoutAbi, DISPERSE, disperseAbi, erc20Abi, orderBookAbi, registrarAbi, registryAbi } from "./abis";
import { clients, deployment, PAY } from "./network";
import { commitmentOf, labelId, newPurchase, type Purchase, SECONDS_PER_YEAR, sealFor } from "./order";
import { switchTo, walletClient } from "./wallet";

export type StepStatus = "todo" | "active" | "done" | "error";

export interface Step {
  key: string;
  title: string;
  status: StepStatus;
  detail?: string;
  tx?: { chain: ChainKey; hash: Hex };
  /** When a wait ends, in this computer's time (ms). */
  until?: number;
}

export type Report = (steps: Step[]) => void;

/** The steps of one purchase, reported to the page as each changes. */
export class Progress {
  steps: Step[];
  constructor(
    titles: [string, string][],
    private report: Report,
  ) {
    this.steps = titles.map(([key, title]) => ({ key, title, status: "todo" }));
    this.emit();
  }
  private emit() {
    this.report(this.steps.map((s) => ({ ...s })));
  }
  set(key: string, patch: Partial<Step>) {
    this.steps = this.steps.map((s) => (s.key === key ? { ...s, ...patch } : s));
    this.emit();
  }
  start = (key: string, patch: Partial<Step> = {}) => this.set(key, { status: "active", ...patch });
  done = (key: string, patch: Partial<Step> = {}) => this.set(key, { status: "done", ...patch });
  /** Marks whatever was running as failed. */
  fail(detail: string) {
    const active = this.steps.find((s) => s.status === "active") ?? this.steps.find((s) => s.status === "todo");
    if (active) this.set(active.key, { status: "error", detail });
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => Math.floor(Date.now() / 1000);
/** Swaps send 2% extra in case the price moves; the change comes straight back. */
const withBuffer = (amount: bigint) => (amount * 102n) / 100n;
export const usdcUnits = (dollars: number) => BigInt(Math.round(dollars * 1_000_000));

function required() {
  if (!deployment) throw new Error("The contracts aren't deployed yet.");
  return deployment;
}

/** The token a payment pulls, or null for the chain's own coin. */
function tokenAddress(key: ChainKey, token: PayToken): Address | null {
  if (token.native) return null;
  if (!token.path) return required()[key].usdc;
  return token.path[0] as Address;
}

/** The swap from `token` to USDC, or no swap for USDC itself. */
function swapFor(key: ChainKey, token: PayToken, amountOutMin: bigint) {
  return {
    router: (token.path ? (token.router ?? PAY[key].router) : zeroAddress) as Address,
    path: (token.path ?? []) as Address[],
    amountOutMin,
    deadline: BigInt(now() + 20 * 60),
  };
}

async function ensureAllowance(key: ChainKey, token: Address, spender: Address, amount: bigint, progress: Progress) {
  const wallet = walletClient(key);
  const owner = wallet.account.address;
  const allowance = await clients[key].readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });
  if (allowance >= amount) return;
  progress.start("approve");
  const hash = await wallet.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
  });
  progress.set("approve", { tx: { chain: key, hash } });
  await confirm(key, hash);
}

async function confirm(key: ChainKey, hash: Hex) {
  const receipt = await clients[key].waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The transaction didn't go through.");
  return receipt;
}

// A purchase waiting out its minute is kept, so a reload carries on rather than starting over.
const PENDING = "hexns-pending";

function savePending(p: Purchase) {
  try {
    localStorage.setItem(PENDING, JSON.stringify({ ...p, duration: p.duration.toString() }));
  } catch {
    // Without storage a reload starts again; nothing is lost but a minute.
  }
}

function loadPending(label: string, owner: Address, duration: bigint): Purchase | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING) ?? "null");
    if (!saved || saved.label !== label || saved.owner !== owner || saved.duration !== duration.toString()) return null;
    return { ...saved, duration: BigInt(saved.duration) };
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    localStorage.removeItem(PENDING);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Buys a name on PulseChain: reserve it with a sealed commitment, wait out the registrar's minute
 * (approving the token meanwhile), then pay through AnyTokenCheckout in one transaction.
 */
export async function buyOnPulseChain(o: {
  label: string;
  years: number;
  token: PayToken;
  referrer: Hex;
  report: Report;
}) {
  const d = required();
  const progress = new Progress(
    [
      ["chain", `Switch to ${PAY.pulsechain.name}`],
      ["commit", "Reserve the name"],
      // Every token but PLS is allowed first, while the minute runs.
      ...(o.token.native ? [] : ([["approve", `Allow ${o.token.label ?? o.token.symbol}`]] as [string, string][])),
      ["wait", "Wait a minute"],
      ["pay", "Pay and register"],
    ],
    o.report,
  );
  try {
    progress.start("chain");
    await switchTo("pulsechain");
    progress.done("chain");
    const wallet = walletClient("pulsechain");
    const owner = wallet.account.address;
    const client = clients.pulsechain;
    const registrar = d.pulsechain.registrar;
    const duration = BigInt(o.years) * SECONDS_PER_YEAR;

    const purchase = loadPending(o.label, owner, duration) ?? newPurchase(o.label, owner, o.years, o.referrer);
    const commitment = commitmentOf(purchase);
    const [minAge, maxAge, at] = await Promise.all([
      client.readContract({ address: registrar, abi: registrarAbi, functionName: "MIN_COMMITMENT_AGE" }),
      client.readContract({ address: registrar, abi: registrarAbi, functionName: "MAX_COMMITMENT_AGE" }),
      client.readContract({ address: registrar, abi: registrarAbi, functionName: "commitmentAt", args: [commitment] }),
    ]);
    let committedAt = Number(at);
    progress.start("commit");
    if (!committedAt || now() > committedAt + Number(maxAge) - 120) {
      savePending(purchase);
      const hash = await wallet.writeContract({
        address: registrar,
        abi: registrarAbi,
        functionName: "commit",
        args: [commitment],
      });
      progress.set("commit", { tx: { chain: "pulsechain", hash } });
      const receipt = await confirm("pulsechain", hash);
      committedAt = Number((await client.getBlock({ blockNumber: receipt.blockNumber })).timestamp);
    }
    progress.done("commit");

    // The chain's clock decides when the minute is up.
    const readyAt = committedAt + Number(minAge) + 1;
    const chainNow = Number((await client.getBlock()).timestamp);
    progress.start("wait", { until: Date.now() + Math.max(0, readyAt - chainNow) * 1000 });

    const token = tokenAddress("pulsechain", o.token);
    const route = swapFor("pulsechain", o.token, 0n);
    const quote = async () =>
      client.readContract({
        address: d.pulsechain.checkout,
        abi: checkoutAbi,
        functionName: "quoteRegister",
        args: [o.label, duration, route.router, route.path],
      });
    if (token) {
      // Allow the token during the wait, so paying is one step when it's over.
      const [, amountIn] = await quote();
      await ensureAllowance(
        "pulsechain",
        token,
        d.pulsechain.checkout,
        o.token.path ? withBuffer(amountIn) : amountIn,
        progress,
      );
      progress.done("approve");
    }
    while (Number((await client.getBlock()).timestamp) < readyAt) await sleep(2000);
    progress.done("wait");

    progress.start("pay");
    const [price, amountIn] = await quote();
    // TypeScript 7 loses viem's type for this struct inside writeContract; RegistrationArg (below)
    // checks the purchase has exactly the shape the contract takes.
    const reg = purchase as never;
    const swap = { ...swapFor("pulsechain", o.token, price), amountOutMin: o.token.path ? price : 0n };
    const hash = token
      ? await wallet.writeContract({
          address: d.pulsechain.checkout,
          abi: checkoutAbi,
          functionName: "registerWithToken",
          args: [reg, token, o.token.path ? withBuffer(amountIn) : amountIn, swap],
        })
      : await wallet.writeContract({
          address: d.pulsechain.checkout,
          abi: checkoutAbi,
          functionName: "registerWithPLS",
          args: [reg, swap],
          value: withBuffer(amountIn),
        });
    progress.set("pay", { tx: { chain: "pulsechain", hash } });
    await confirm("pulsechain", hash);
    clearPending();
    progress.done("pay");
  } catch (error) {
    progress.fail(errorText(error));
    throw error;
  }
}

/**
 * Buys a name from Ethereum: one order holding the payment, with the name sealed so only the bot
 * can read it. The bot registers it on PulseChain within about a minute and a half; if it can't,
 * the money comes back over the bridge.
 */
export async function buyFromEthereum(o: {
  label: string;
  years: number;
  token: PayToken;
  referrer: Hex;
  report: Report;
}) {
  const d = required();
  const progress = new Progress(
    [
      ["chain", `Switch to ${PAY.ethereum.name}`],
      ...(o.token.native ? [] : ([["approve", `Allow ${o.token.symbol}`]] as [string, string][])),
      ["order", "Place the order"],
      ["fill", "Registered on PulseChain"],
    ],
    o.report,
  );
  try {
    progress.start("chain");
    await switchTo("ethereum");
    progress.done("chain");
    const wallet = walletClient("ethereum");
    const owner = wallet.account.address;
    const purchase = newPurchase(o.label, owner, o.years, o.referrer);
    const commitment = commitmentOf(purchase);
    const sealed = sealFor(purchase, d.bot.publicKey);

    // The price is the registrar's, on PulseChain, plus the bot's fee.
    const [base, premium] = await clients.pulsechain.readContract({
      address: d.pulsechain.registrar,
      abi: registrarAbi,
      functionName: "getRegisterPrice",
      args: [o.label, purchase.duration, d.pulsechain.usdc],
    });
    const amount = base + premium + usdcUnits(d.bot.minFee);
    const book = d.ethereum.orderBook;
    const token = tokenAddress("ethereum", o.token);
    const route = swapFor("ethereum", o.token, amount);
    const amountIn = o.token.path
      ? withBuffer(
          await clients.ethereum.readContract({
            address: book,
            abi: orderBookAbi,
            functionName: "quote",
            args: [amount, route.router, route.path],
          }),
        )
      : amount;
    if (token) {
      await ensureAllowance("ethereum", token, book, amountIn, progress);
      progress.done("approve");
    }

    progress.start("order");
    const hash = !o.token.path
      ? await wallet.writeContract({
          address: book,
          abi: orderBookAbi,
          functionName: "placeOrder",
          args: [commitment, amount, sealed],
        })
      : o.token.native
        ? await wallet.writeContract({
            address: book,
            abi: orderBookAbi,
            functionName: "placeOrderWithETH",
            args: [commitment, amount, sealed, route],
            value: amountIn,
          })
        : await wallet.writeContract({
            address: book,
            abi: orderBookAbi,
            functionName: "placeOrderWithToken",
            args: [commitment, amount, sealed, token!, amountIn, route],
          });
    progress.set("order", { tx: { chain: "ethereum", hash } });
    await confirm("ethereum", hash);
    keepOrder(purchase, hash);
    progress.done("order");

    progress.start("fill", { detail: "Usually within a minute and a half." });
    const id = labelId(o.label);
    const deadline = Date.now() + 35 * 60 * 1000;
    while (Date.now() < deadline) {
      const holder = await clients.pulsechain
        .readContract({ address: d.pulsechain.registry, abi: registryAbi, functionName: "getOwner", args: [id] })
        .catch(() => zeroAddress);
      if (holder.toLowerCase() === owner.toLowerCase()) {
        progress.done("fill", { detail: undefined });
        return;
      }
      await sleep(5000);
    }
    progress.set("fill", {
      status: "error",
      detail: "It's taking longer than usual. If the name can't be registered, your money comes back automatically.",
    });
  } catch (error) {
    progress.fail(errorText(error));
    throw error;
  }
}

/** The registration AnyTokenCheckout takes. A purchase must be exactly that. */
type RegistrationArg = ContractFunctionArgs<typeof checkoutAbi, "nonpayable", "registerWithToken">[0];
export const purchaseFitsTheContract = (p: Purchase): RegistrationArg => p;

/** Keeps an order's details in this browser, in case the buyer ever needs them for a refund. */
function keepOrder(p: Purchase, tx: Hex) {
  try {
    const orders = JSON.parse(localStorage.getItem("hexns-orders") ?? "[]");
    orders.push({ ...p, duration: p.duration.toString(), tx, at: Date.now() });
    localStorage.setItem("hexns-orders", JSON.stringify(orders.slice(-50)));
  } catch {
    // Not essential: the order is on-chain either way.
  }
}

/** Renews a name on PulseChain for `years` more. Anyone can renew any name; it stays its owner's. */
export async function renew(o: { label: string; years: number; token: PayToken; referrer: Hex; report: Report }) {
  const d = required();
  const progress = new Progress(
    [
      ["chain", `Switch to ${PAY.pulsechain.name}`],
      ...(o.token.native ? [] : ([["approve", `Allow ${o.token.label ?? o.token.symbol}`]] as [string, string][])),
      ["pay", "Pay and renew"],
    ],
    o.report,
  );
  try {
    progress.start("chain");
    await switchTo("pulsechain");
    progress.done("chain");
    const wallet = walletClient("pulsechain");
    const duration = BigInt(o.years) * SECONDS_PER_YEAR;
    const route = swapFor("pulsechain", o.token, 0n);
    const [price, amountIn] = await clients.pulsechain.readContract({
      address: d.pulsechain.checkout,
      abi: checkoutAbi,
      functionName: "quoteRenew",
      args: [o.label, duration, route.router, route.path],
    });
    const pay = o.token.path ? withBuffer(amountIn) : amountIn;
    const token = tokenAddress("pulsechain", o.token);
    if (token) {
      await ensureAllowance("pulsechain", token, d.pulsechain.checkout, pay, progress);
      progress.done("approve");
    }
    progress.start("pay");
    const ren = { label: o.label, duration, referrer: o.referrer };
    const swap = { ...swapFor("pulsechain", o.token, price), amountOutMin: o.token.path ? price : 0n };
    const hash = token
      ? await wallet.writeContract({
          address: d.pulsechain.checkout,
          abi: checkoutAbi,
          functionName: "renewWithToken",
          args: [ren, token, pay, swap],
        })
      : await wallet.writeContract({
          address: d.pulsechain.checkout,
          abi: checkoutAbi,
          functionName: "renewWithPLS",
          args: [ren, swap],
          value: pay,
        });
    progress.set("pay", { tx: { chain: "pulsechain", hash } });
    await confirm("pulsechain", hash);
    progress.done("pay");
  } catch (error) {
    progress.fail(errorText(error));
    throw error;
  }
}

/** Sends a name to another wallet on PulseChain. Its Ethereum copy follows by itself. */
export async function send(o: { label: string; to: Address; report: Report }) {
  const d = required();
  const progress = new Progress(
    [
      ["chain", `Switch to ${PAY.pulsechain.name}`],
      ["send", "Send it"],
    ],
    o.report,
  );
  try {
    progress.start("chain");
    await switchTo("pulsechain");
    progress.done("chain");
    const wallet = walletClient("pulsechain");
    const state = await clients.pulsechain.readContract({
      address: d.pulsechain.registry,
      abi: registryAbi,
      functionName: "getState",
      args: [labelId(o.label)],
    });
    progress.start("send");
    const hash = await wallet.writeContract({
      address: d.pulsechain.registry,
      abi: registryAbi,
      functionName: "safeTransferFrom",
      args: [wallet.account.address, o.to, state.tokenId, 1n, "0x"],
    });
    progress.set("send", { tx: { chain: "pulsechain", hash } });
    await confirm("pulsechain", hash);
    progress.done("send");
  } catch (error) {
    progress.fail(errorText(error));
    throw error;
  }
}

/**
 * Pays referrers what they're owed, from the connected wallet, in one transaction: allow Disperse
 * the exact total in USDC, then Disperse sends each amount. `amounts` are in USDC's own units.
 */
export async function payReferrers(o: { payments: { to: Address; amount: bigint }[]; report: Report }): Promise<Hex> {
  const d = required();
  const total = o.payments.reduce((sum, p) => sum + p.amount, 0n);
  const progress = new Progress(
    [
      ["chain", `Switch to ${PAY.pulsechain.name}`],
      ["approve", "Allow the total in USDC"],
      ["pay", `Pay ${o.payments.length} ${o.payments.length === 1 ? "referrer" : "referrers"}`],
    ],
    o.report,
  );
  try {
    progress.start("chain");
    await switchTo("pulsechain");
    progress.done("chain");
    const wallet = walletClient("pulsechain");
    const balance = await clients.pulsechain.readContract({
      address: d.pulsechain.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [wallet.account.address],
    });
    if (balance < total) throw new Error("This wallet doesn't hold enough USDC on PulseChain to pay everyone.");
    await ensureAllowance("pulsechain", d.pulsechain.usdc, DISPERSE, total, progress);
    progress.done("approve");
    progress.start("pay");
    const hash = await wallet.writeContract({
      address: DISPERSE,
      abi: disperseAbi,
      functionName: "disperseToken",
      args: [d.pulsechain.usdc, o.payments.map((p) => p.to), o.payments.map((p) => p.amount)],
    });
    progress.set("pay", { tx: { chain: "pulsechain", hash } });
    await confirm("pulsechain", hash);
    progress.done("pay");
    return hash;
  } catch (error) {
    progress.fail(errorText(error));
    throw error;
  }
}

/** A failure, said plainly. */
export function errorText(error: unknown): string {
  const e = error as { code?: number; shortMessage?: string; message?: string; cause?: { code?: number } };
  if (e?.code === 4001 || e?.cause?.code === 4001 || /user (rejected|denied)/i.test(e?.message ?? "")) {
    return "You cancelled it in your wallet. Nothing was paid.";
  }
  if (/insufficient funds/i.test(e?.message ?? ""))
    return "Not enough in your wallet to pay for this, and its network fee.";
  return e?.shortMessage ?? e?.message ?? "Something went wrong.";
}
