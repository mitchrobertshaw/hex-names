// Claims bridge messages from the .hex contracts on Ethereum, as soon as validators have signed them.
//
// HexOrderFiller's messages pay fillers or refund buyers; HexMirrorSync's keep the Ethereum copy up
// to date. The bridge signs them on PulseChain (about 11 to 15 minutes), and then someone has to
// submit them on Ethereum and pay the gas (a few cents). Anyone may; this bot does it for every
// message the .hex contracts send. The signatures are checked by the bridge, so the bot cannot
// alter a message, only deliver it.

import { type Address, type Hex, decodeFunctionData, getAbiItem, isAddressEqual, keccak256, toBytes, zeroAddress } from "viem";

import { ORDER_STATUS, REGISTERED, bridgeCallsAbi, foreignAmbAbi, homeAmbAbi, mirrorRegistrarAbi, mirrorRegistryAbi, orderBookAbi } from "./abis.ts";
import { isFullySigned, packSignatures, parseAmbMessage } from "./amb.ts";
import type { Context } from "./context.ts";
import { send, short } from "./orders.ts";
import type { MessageRecord } from "./state.ts";

const LOG_RANGE = 50_000n;
const userRequestForSignature = getAbiItem({ abi: homeAmbAbi, name: "UserRequestForSignature" });

/** Records messages the .hex contracts sent through the bridge since the last scan. */
export async function scanMessages(ctx: Context): Promise<void> {
  const latest = await ctx.pls.getBlockNumber();
  const senders = new Set<Address>([ctx.config.orderFiller, ctx.config.mirrorSync].map((a) => a.toLowerCase() as Address));
  for (let from = BigInt(ctx.state.pulsechainAmbBlock) + 1n; from <= latest; from += LOG_RANGE) {
    const to = from + LOG_RANGE - 1n < latest ? from + LOG_RANGE - 1n : latest;
    const logs = await ctx.pls.getLogs({ address: ctx.config.homeAmb, event: userRequestForSignature, fromBlock: from, toBlock: to });
    for (const log of logs) {
      const message = parseAmbMessage(log.args.encodedData!);
      if (!senders.has(message.sender.toLowerCase() as Address) || ctx.state.messages[message.messageId]) continue;
      ctx.state.messages[message.messageId] = {
        messageId: message.messageId,
        encoded: message.encoded,
        hash: message.hash,
        gasLimit: message.gasLimit.toString(),
        sender: message.sender,
        seenAtBlock: log.blockNumber.toString(),
        status: "waiting",
      };
    }
    ctx.state.pulsechainAmbBlock = to.toString();
  }
}

/** Claims every waiting message that validators have finished signing. */
export async function claimMessages(ctx: Context): Promise<void> {
  const waiting = Object.values(ctx.state.messages).filter((m) => m.status === "waiting");
  if (waiting.length === 0) return;
  const required = await ctx.pls.readContract({ address: ctx.config.homeAmb, abi: homeAmbAbi, functionName: "requiredSignatures" });
  for (const message of waiting) {
    try {
      const relayed = await ctx.eth.readContract({ address: ctx.config.foreignAmb, abi: foreignAmbAbi, functionName: "relayedMessages", args: [message.messageId] });
      if (relayed) {
        message.status = "claimed-by-someone-else";
        continue;
      }
      const signed = await ctx.pls.readContract({ address: ctx.config.homeAmb, abi: homeAmbAbi, functionName: "numMessagesSigned", args: [message.hash] });
      if (!isFullySigned(signed, required)) continue;
      const skip = await reasonToSkip(ctx, message, waiting);
      if (skip) {
        message.status = "skipped";
        message.note = skip;
        ctx.log(`bridge message ${message.messageId}: not claiming it, ${skip}`);
        continue;
      }
      const signatures: Hex[] = [];
      for (let i = 0n; i < required; i++) {
        signatures.push(await ctx.pls.readContract({ address: ctx.config.homeAmb, abi: homeAmbAbi, functionName: "signature", args: [message.hash, i] }));
      }
      const tx = await send(ctx, "eth", {
        address: ctx.config.foreignAmb,
        abi: foreignAmbAbi,
        functionName: "executeSignatures",
        args: [message.encoded, packSignatures(signatures)],
        gas: BigInt(message.gasLimit) + 300_000n,
      });
      message.status = "claimed";
      message.tx = tx;
      ctx.log(`bridge message ${message.messageId} from ${message.sender === ctx.config.orderFiller ? "HexOrderFiller" : "HexMirrorSync"} claimed on Ethereum (${tx})`);
    } catch (error) {
      ctx.log(`bridge message ${message.messageId}: ${short(error)} (will retry)`);
    }
  }
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
