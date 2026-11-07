import { describe, expect, it } from "vitest";

import {
  LABEL_REGISTERED,
  type RegistrationLog,
  type Rpc,
  freshState,
  labelOf,
  scan,
  showable,
  summarise,
  timeAgo,
} from "./stats";

// Two real LabelRegistered logs, from ENS's own ENSv2 .eth registry on Sepolia (7 November 2026).
const ENS_ON_SEPOLIA: RegistrationLog[] = [
  {
    blockNumber: "0xb8432d",
    blockTimestamp: "0x6aeda478",
    data: "0x00000000000000000000000000000000000000000000000000000000000000600000000000000000000000006f1524f5a1152d6b08ef8833e42e4311151e904f000000000000000000000000000000000000000000000000000000006cced7f80000000000000000000000000000000000000000000000000000000000000008626c6f636b616964000000000000000000000000000000000000000000000000",
  },
  {
    blockNumber: "0xb84363",
    blockTimestamp: "0x6aeda700",
    data: "0x00000000000000000000000000000000000000000000000000000000000000600000000000000000000000003a05d06949b9890aead4700aa5ecebf4d1ba0ba0000000000000000000000000000000000000000000000000000000006cceda80000000000000000000000000000000000000000000000000000000000000000965746865727363616e0000000000000000000000000000000000000000000000",
  },
];

const word = (n: number | bigint) => n.toString(16).padStart(64, "0");

/** A LabelRegistered log as the registry writes it: (string label, address owner, uint64 expiry). */
function logOf(label: string, block: number, at?: number): RegistrationLog {
  const bytes = [...new TextEncoder().encode(label)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const padded = bytes.padEnd(Math.ceil(bytes.length / 64) * 64, "0");
  return {
    blockNumber: `0x${block.toString(16)}`,
    blockTimestamp: at === undefined ? undefined : `0x${at.toString(16)}`,
    data: `0x${word(0x60)}${word(0xdead)}${word(2_000_000_000)}${word(bytes.length / 2)}${padded}`,
  };
}

/** A chain whose head is `head` at `headTime`, with `logs`, refusing log ranges wider than `widest`. */
function fakeChain(head: number, headTime: number, logs: RegistrationLog[], widest = Infinity) {
  const calls: { from: number; to: number }[] = [];
  const rpc: Rpc = async (method, params) => {
    if (method === "eth_getBlockByNumber") return { number: `0x${head.toString(16)}`, timestamp: `0x${headTime.toString(16)}` };
    if (method === "eth_getLogs") {
      const filter = params[0] as { address: string; topics: string[]; fromBlock: string; toBlock: string };
      expect(filter.topics).toEqual([LABEL_REGISTERED]);
      const from = Number(filter.fromBlock);
      const to = Number(filter.toBlock);
      if (to - from + 1 > widest) throw new Error("block range too large");
      calls.push({ from, to });
      return logs.filter((log) => Number(log.blockNumber) >= from && Number(log.blockNumber) <= to);
    }
    throw new Error(`unexpected ${method}`);
  };
  return { rpc, calls };
}

const NOW = 1_800_000_000;

describe("live stats", () => {
  it("read the names from real ENSv2 registrations", () => {
    expect(ENS_ON_SEPOLIA.map((log) => labelOf(log.data))).toEqual(["blockaid", "etherscan"]);
  });

  it("read names in any script, and longer than one word", () => {
    for (const label of ["ünïcode🙂", "a".repeat(40), "abc"]) expect(labelOf(logOf(label, 1).data)).toBe(label);
  });

  it("count every registration, newest first, with when it happened", async () => {
    const logs = [logOf("alice", 950, NOW - 500), logOf("bob", 990), logOf("carol", 1000)];
    const { rpc } = fakeChain(1000, NOW, logs);
    const state = await scan(freshState(900), { rpc, registry: "0x1", deadline: Date.now() + 5000 });
    expect(state.names).toBe(3);
    expect(state.block).toBe(1000);
    expect(state.behind).toBe(false);
    expect(state.recent.map((r) => r.label)).toEqual(["carol", "bob", "alice"]);
    // From the log when the node gives it, else 10 seconds a block back from the head.
    expect(state.recent.map((r) => r.at)).toEqual([NOW, NOW - 100, NOW - 500]);
  });

  it("carry on from where they stopped, without counting anything twice", async () => {
    const logs = [logOf("alice", 950), logOf("bob", 1500)];
    const first = await scan(freshState(900), { ...fakeChain(1000, NOW - 5000, logs), registry: "0x1", deadline: Date.now() + 5000 });
    const second = await scan(first, { ...fakeChain(2000, NOW, logs), registry: "0x1", deadline: Date.now() + 5000 });
    expect(second.names).toBe(2);
    expect(second.recent.map((r) => r.label)).toEqual(["bob", "alice"]);
  });

  it("ask for narrower ranges when the RPC refuses wide ones", async () => {
    const chain = fakeChain(100_000, NOW, [logOf("alice", 42_000)], 2_000);
    const state = await scan(freshState(1), { rpc: chain.rpc, registry: "0x1", deadline: Date.now() + 5000 });
    expect(state.names).toBe(1);
    expect(state.block).toBe(100_000);
    expect(Math.max(...chain.calls.map((c) => c.to - c.from + 1))).toBeLessThanOrEqual(2_000);
  });

  it("stop at the deadline and say they are behind", async () => {
    const chain = fakeChain(1_000_000, NOW, []);
    const state = await scan(freshState(1), { rpc: chain.rpc, registry: "0x1", deadline: Date.now() - 1 });
    expect(state.behind).toBe(true);
    expect(state.block).toBe(0);
  });

  it("keep the last day's names, and at least the latest 10", async () => {
    const old = Array.from({ length: 15 }, (_, i) => logOf(`old${i}`, 100 + i, NOW - 3 * 86_400));
    const today = Array.from({ length: 12 }, (_, i) => logOf(`new${i}`, 9_000 + i, NOW - 3600));
    const state = await scan(freshState(1), { ...fakeChain(10_000, NOW, [...old, ...today]), registry: "0x1", deadline: Date.now() + 5000 });
    expect(state.names).toBe(27);
    expect(state.recent).toHaveLength(12);
    expect(summarise(state, NOW).last24h).toBe(12);

    const quiet = await scan(freshState(1), { ...fakeChain(10_000, NOW, old), registry: "0x1", deadline: Date.now() + 5000 });
    expect(quiet.recent).toHaveLength(10);
    expect(summarise(quiet, NOW).last24h).toBe(0);
  });

  it("show only plain, polite names, at most six", () => {
    const recent = ["alice", "Bob", "free-money", "ünïcode", "x".repeat(25), "carol", "dave", "erin", "frank", "grace", "heidi"].map(
      (label, i) => ({ label, block: 100 - i, at: NOW - i * 60 }),
    );
    const stats = summarise({ block: 100, names: 11, recent }, NOW);
    expect(stats.latest.map((r) => r.label)).toEqual(["alice", "carol", "dave", "erin", "frank", "grace"]);
    expect(stats.names).toBe(11);
    expect(showable("pulse-chain369")).toBe(true);
    expect(showable("ab")).toBe(false);
  });

  it("say how long ago", () => {
    expect(timeAgo(NOW - 20, NOW)).toBe("just now");
    expect(timeAgo(NOW - 5 * 60, NOW)).toBe("5 min ago");
    expect(timeAgo(NOW - 3600, NOW)).toBe("1 hour ago");
    expect(timeAgo(NOW - 5 * 3600, NOW)).toBe("5 hours ago");
    expect(timeAgo(NOW - 86_400, NOW)).toBe("1 day ago");
    expect(timeAgo(NOW + 30, NOW)).toBe("just now");
  });
});
