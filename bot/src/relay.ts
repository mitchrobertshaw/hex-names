// Claims bridge messages from the .hex contracts on Ethereum, as soon as validators have signed them.
//
// HexOrderFiller's messages pay fillers or refund buyers; HexMirrorSync's keep the Ethereum copy up
// to date. The bridge signs them on PulseChain (about 11 to 15 minutes), and then someone has to
// submit them on Ethereum and pay the gas (a few cents). Anyone may; this bot does it for every
// message the .hex contracts send, and for its own USDC sent to Ethereum to buy ETH. The signatures
// are checked by the bridge, so the bot cannot alter a message, only deliver it.

import {
  type Address,
  type Hex,
  type TransactionReceipt,
  decodeFunctionData,
  getAbiItem,
  isAddressEqual,
  keccak256,
  toBytes,
  zeroAddress,
} from "viem";

import {
  ORDER_STATUS,
  REGISTERED,
  bridgeCallsAbi,
  foreignAmbAbi,
  homeAmbAbi,
  mirrorRegistrarAbi,
  mirrorRegistryAbi,
  orderBookAbi,
  tokenBridgeCallsAbi,
} from "./abis.ts";
import { type AmbMessage, isFullySigned, packSignatures, parseAmbMessage } from "./amb.ts";
import type { RelayLimits } from "./config.ts";
import type { Context } from "./context.ts";
import { short, submit } from "./orders.ts";
import type { MessageRecord, RelayState } from "./state.ts";

const LOG_RANGE = 50_000n;
/** About what a claim costs in gas, for the daily allowance and the ETH kept back. */
export const CLAIM_GAS = 300_000n;
/** Gas kept back from other claims for the bot's own refill: claiming its USDC, approving, buying ETH. */
export const REFILL_GAS = 500_000n;
/** A claim not seen mined after this long is taken as dropped, and sent again. */
const CLAIM_TIMEOUT = 15n * 60n;
const HOUR = 3600n;
const userRequestForSignature = getAbiItem({ abi: homeAmbAbi, name: "UserRequestForSignature" });

/**
 * The USDC arriving on Ethereum, if `message` is the bot's own transfer of USDC from PulseChain to
 * its wallet on Ethereum (sent to buy ETH); null for anything else.
 */
export function ownTransfer(message: AmbMessage, bot: Address, homeBridge: Address, ethereumUsdc: Address): bigint | null {
  if (!isAddressEqual(message.sender, homeBridge)) return null;
  try {
    const [token, receiver, value] = decodeFunctionData({ abi: tokenBridgeCallsAbi, data: message.data }).args;
    return isAddressEqual(receiver, bot) && isAddressEqual(token, ethereumUsdc) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Records messages the .hex contracts sent through the bridge since the last scan, and the bot's
 * own USDC transfers to Ethereum: found here even if the bot lost track of sending one.
 */
export async function scanMessages(ctx: Context): Promise<void> {
  const latest = await ctx.pls.getBlockNumber();
  const senders = new Set<Address>([ctx.config.orderFiller, ctx.config.mirrorSync].map((a) => a.toLowerCase() as Address));
  const t = ctx.config.treasury;
  for (let from = BigInt(ctx.state.pulsechainAmbBlock) + 1n; from <= latest; from += LOG_RANGE) {
    const to = from + LOG_RANGE - 1n < latest ? from + LOG_RANGE - 1n : latest;
    const logs = await ctx.pls.getLogs({ address: ctx.config.homeAmb, event: userRequestForSignature, fromBlock: from, toBlock: to });
    for (const log of logs) {
      const message = parseAmbMessage(log.args.encodedData!);
      if (ctx.state.messages[message.messageId]) continue;
      const own = ownTransfer(message, ctx.account.address, t.homeBridge, t.ethereumUsdc);
      if (own === null && !senders.has(message.sender.toLowerCase() as Address)) continue;
      ctx.state.messages[message.messageId] = {
        messageId: message.messageId,
        encoded: message.encoded,
        hash: message.hash,
        gasLimit: message.gasLimit.toString(),
        sender: message.sender,
        seenAtBlock: log.blockNumber.toString(),
        status: "waiting",
        ...(own === null ? {} : { own: { usdc: own.toString() } }),
      };
    }
    ctx.state.pulsechainAmbBlock = to.toString();
  }
}

export type Hold = {
  kind: "own" | "mirror" | "settle";
  label?: string; // the name a mirror message copies
  now: bigint;
  cost: bigint; // about what claiming it costs, in wei
  ethBalance: bigint;
  reserve: bigint; // wei kept back for claiming the bot's own refill
  limits: RelayLimits;
  relay: RelayState;
};

/**
 * Why a message should wait rather than be claimed now, or null to claim it. The bot's own USDC is
 * always claimed (it buys the ETH everything else needs). Others leave enough ETH for that; copies
 * of names also keep within the day's ETH allowance, and to one copy of a name an hour (the newest
 * change wins, so nothing is lost by waiting).
 */
export function holdReason(h: Hold): string | null {
  if (h.kind === "own") return null;
  if (h.ethBalance < h.reserve + h.cost) return "low on ETH: what's left is kept for claiming its own USDC to buy more";
  if (h.kind !== "mirror") return null;
  if (BigInt(h.relay.spent) + h.cost > h.limits.dailyEth) {
    return "at today's limit of ETH for copying names (RELAY_DAILY_ETH): the rest wait until tomorrow (UTC)";
  }
  const last = h.label === undefined ? undefined : h.relay.lastClaim[h.label];
  if (last !== undefined && h.now - BigInt(last) < h.limits.nameCooldown) {
    return `${h.label}.hex was copied less than ${h.limits.nameCooldown / 60n} minutes ago: its newest change follows after that`;
  }
  return null;
}

const utcDay = (now: bigint) => new Date(Number(now) * 1000).toISOString().slice(0, 10);

/** The relay's own records, with the day's spending started afresh each UTC day. */
function relayState(ctx: Context, now: bigint): RelayState {
  const relay = (ctx.state.relay ??= { day: utcDay(now), spent: "0", lastClaim: {}, noted: {} });
  if (relay.day !== utcDay(now)) {
    relay.day = utcDay(now);
    relay.spent = "0";
  }
  const cooldown = ctx.config.relayLimits.nameCooldown;
  for (const [label, at] of Object.entries(relay.lastClaim)) if (now - BigInt(at) >= cooldown) delete relay.lastClaim[label];
  for (const [text, at] of Object.entries(relay.noted)) if (now - BigInt(at) >= 24n * HOUR) delete relay.noted[text];
  return relay;
}

/** The name a HexMirrorSync message copies, if it is one. */
function labelOf(message: MessageRecord): string | undefined {
  try {
    const call = decodeFunctionData({ abi: bridgeCallsAbi, data: parseAmbMessage(message.encoded).data });
    return call.functionName === "mirror" ? call.args[0] : undefined;
  } catch {
    return undefined;
  }
}

/** Claims every waiting message that validators have finished signing, the bot's own first. */
export async function claimMessages(ctx: Context): Promise<void> {
  const waiting = Object.values(ctx.state.messages).filter((m) => m.status === "waiting");
  if (waiting.length === 0) return;
  waiting.sort((a, b) => Number(Boolean(b.own)) - Number(Boolean(a.own)));
  const now = BigInt(Math.floor(Date.now() / 1000));
  const relay = relayState(ctx, now);
  let funds: { gasPrice: bigint; eth: bigint } | null = null;
  const required = await ctx.pls.readContract({ address: ctx.config.homeAmb, abi: homeAmbAbi, functionName: "requiredSignatures" });
  for (const message of waiting) {
    try {
      // A claim already sent: wait for it, rather than send another that would only revert.
      if (message.claimTx && !(await claimSettled(ctx, message, relay, now))) continue;
      if (message.status !== "waiting") continue;
      const relayed = await ctx.eth.readContract({ address: ctx.config.foreignAmb, abi: foreignAmbAbi, functionName: "relayedMessages", args: [message.messageId] });
      if (relayed) {
        message.status = "claimed-by-someone-else";
        continue;
      }
      const signed = await ctx.pls.readContract({ address: ctx.config.homeAmb, abi: homeAmbAbi, functionName: "numMessagesSigned", args: [message.hash] });
      if (!isFullySigned(signed, required)) continue;
      const skip = message.own ? null : await reasonToSkip(ctx, message, waiting);
      if (skip) {
        message.status = "skipped";
        message.note = skip;
        ctx.log(`bridge message ${message.messageId}: not claiming it, ${skip}`);
        continue;
      }
      const kind = message.own ? "own" : isAddressEqual(message.sender as Address, ctx.config.orderFiller) ? "settle" : "mirror";
      if (kind !== "own") {
        funds ??= { gasPrice: await ctx.eth.getGasPrice(), eth: await ctx.eth.getBalance({ address: ctx.account.address }) };
        const hold = holdReason({
          kind,
          label: kind === "mirror" ? labelOf(message) : undefined,
          now,
          cost: funds.gasPrice * CLAIM_GAS,
          ethBalance: funds.eth,
          reserve: funds.gasPrice * REFILL_GAS,
          limits: ctx.config.relayLimits,
          relay,
        });
        if (hold) {
          noteOnce(ctx, relay, now, `bridge: holding back a claim, ${hold}`);
          continue;
        }
      }
      const signatures: Hex[] = [];
      for (let i = 0n; i < required; i++) {
        signatures.push(await ctx.pls.readContract({ address: ctx.config.homeAmb, abi: homeAmbAbi, functionName: "signature", args: [message.hash, i] }));
      }
      const hash = await submit(ctx, "eth", {
        address: ctx.config.foreignAmb,
        abi: foreignAmbAbi,
        functionName: "executeSignatures",
        args: [message.encoded, packSignatures(signatures)],
        gas: BigInt(message.gasLimit) + 300_000n,
      });
      message.claimTx = hash;
      message.claimSentAt = now.toString();
      ctx.save();
      const cost = finishClaim(ctx, message, await ctx.eth.waitForTransactionReceipt({ hash }), relay, now);
      if (funds) funds.eth -= cost;
    } catch (error) {
      ctx.log(`bridge message ${message.messageId}: ${short(error)} (will retry)`);
    }
  }
}

/** Records how a claim went, and what it cost; returns the cost in wei. */
function finishClaim(ctx: Context, message: MessageRecord, receipt: TransactionReceipt, relay: RelayState, now: bigint): bigint {
  const cost = receipt.gasUsed * receipt.effectiveGasPrice;
  delete message.claimTx;
  delete message.claimSentAt;
  if (receipt.status !== "success") {
    ctx.log(`bridge message ${message.messageId}: the claim ${receipt.transactionHash} reverted (will retry)`);
    return cost;
  }
  message.status = "claimed";
  message.tx = receipt.transactionHash;
  const label = message.own ? undefined : labelOf(message);
  if (label !== undefined) {
    relay.spent = (BigInt(relay.spent) + cost).toString();
    relay.lastClaim[label] = now.toString();
  }
  const from = message.own ? "the bot's own USDC, for gas" : label !== undefined ? `HexMirrorSync, ${label}.hex` : "HexOrderFiller";
  ctx.log(`bridge message ${message.messageId} (${from}) claimed on Ethereum (${receipt.transactionHash})`);
  return cost;
}

/** For a claim sent earlier: true once it's settled (mined, or given up on), false while it may still be mined. */
async function claimSettled(ctx: Context, message: MessageRecord, relay: RelayState, now: bigint): Promise<boolean> {
  const receipt = await ctx.eth.getTransactionReceipt({ hash: message.claimTx! }).catch(() => null);
  if (receipt) {
    finishClaim(ctx, message, receipt, relay, now);
    return true;
  }
  if (now - BigInt(message.claimSentAt ?? "0") < CLAIM_TIMEOUT) return false;
  ctx.log(`bridge message ${message.messageId}: its claim ${message.claimTx} was never mined; claiming it again`);
  delete message.claimTx;
  delete message.claimSentAt;
  return true;
}

/** Logs `text` at most once an hour. */
function noteOnce(ctx: Context, relay: RelayState, now: bigint, text: string): void {
  const last = relay.noted[text];
  if (last !== undefined && now - BigInt(last) < HOUR) return;
  relay.noted[text] = now.toString();
  ctx.log(text);
}

/**
 * Anyone can make the .hex contracts send a message (report a made-up expired order, or sync a
 * name that has not changed) for a fraction of a cent on PulseChain, while claiming it costs ETH.
 * So only messages that would change something on Ethereum are claimed. Returns why a message is
 * not worth claiming, or null if it is.
 */
async function reasonToSkip(ctx: Context, message: MessageRecord, waiting: MessageRecord[]): Promise<string | null> {
  const { config } = ctx;
  const parsed = parseAmbMessage(message.encoded);
  let call;
  try {
    call = decodeFunctionData({ abi: bridgeCallsAbi, data: parsed.data });
  } catch {
    return "it is not a .hex call";
  }

  if (call.functionName === "settle") {
    if (!isAddressEqual(parsed.executor, config.orderBook)) return "it is for a different order book";
    const [orderId, commitment, deadline] = call.args;
    const [, , orderCommitment, orderDeadline, status] = await ctx.eth.readContract({ address: config.orderBook, abi: orderBookAbi, functionName: "orders", args: [orderId] });
    if (status !== ORDER_STATUS.OPEN || orderCommitment !== commitment || orderDeadline !== deadline) {
      return "it does not match an open order";
    }
    return null;
  }

  if (!isAddressEqual(parsed.executor, config.mirrorRegistrar)) return "it is for a different Ethereum copy";
  const [label, owner, expiry, nonce] = call.args;
  const labelId = BigInt(keccak256(toBytes(label)));
  const last = await ctx.eth.readContract({ address: config.mirrorRegistrar, abi: mirrorRegistrarAbi, functionName: "lastNonce", args: [labelId] });
  if (nonce <= last) return `Ethereum already has a newer copy of ${label}.hex`;
  for (const other of waiting) {
    if (other.messageId === message.messageId) continue;
    try {
      const o = decodeFunctionData({ abi: bridgeCallsAbi, data: parseAmbMessage(other.encoded).data });
      if (o.functionName === "mirror" && o.args[0] === label && o.args[3] > nonce) return `a newer copy of ${label}.hex is on its way`;
    } catch {}
  }
  const registry = await ctx.eth.readContract({ address: config.mirrorRegistrar, abi: mirrorRegistrarAbi, functionName: "REGISTRY" });
  const state = await ctx.eth.readContract({ address: registry, abi: mirrorRegistryAbi, functionName: "getState", args: [labelId] });
  const now = (await ctx.eth.getBlock()).timestamp;
  const live = !isAddressEqual(owner, zeroAddress) && expiry > now;
  const registered = state.status === REGISTERED;
  if (!live && !registered) return `${label}.hex is not on Ethereum and should not be`;
  if (live && registered && isAddressEqual(state.latestOwner, owner) && state.expiry === expiry) {
    return `Ethereum already shows ${label}.hex as it is on PulseChain`;
  }
  return null;
}
