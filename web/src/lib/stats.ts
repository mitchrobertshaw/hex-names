// The live numbers on the homepage: how many .hex names are registered and which were registered
// last, read from the .hex registry on PulseChain. The site's stats function
// (netlify/functions/stats.mts) reads the new blocks at most about once a minute and keeps its
// place between visits, so visitors' browsers never have to scan the chain.

/** ENSv2's event for every name registered, bought or given at deployment:
 *  keccak256("LabelRegistered(uint256,bytes32,string,address,uint64,address)").
 *  test/unit/WebsiteStats.t.sol checks it against the registry the contracts are built from. */
export const LABEL_REGISTERED = "0x2fe093918572373e9f1f0368f414dffd0043a74ae8c9fd7b0e390b26a0d20b6e";

/** PulseChain, and its testnet, make a block every 10 seconds. */
const BLOCK_SECONDS = 10;
const DAY = 86_400;

/** The count shows once it is worth showing. Until then the latest names carry the strip. */
export const SHOW_NAMES_FROM = 100;
export const SHOW_DAY_FROM = 10;

export interface RegistrationLog {
  blockNumber: string;
  data: string;
  blockTimestamp?: string; // some nodes include it
}

export interface Registration {
  label: string;
  block: number;
  at: number; // unix seconds
}

/** What the stats function keeps between visits. */
export interface ScanState {
  block: number; // the last block read
  names: number; // names registered so far
  recent: Registration[]; // newest first: the last day's, and always the latest 10
}

/** What the homepage shows. */
export interface LiveStats {
  live: true;
  names: number;
  last24h: number;
  latest: { label: string; at: number }[];
}

export type Rpc = (method: string, params: unknown[]) => Promise<unknown>;

/** A JSON-RPC client for `url`. */
export function jsonRpc(url: string, timeoutMs = 8000): Rpc {
  return async (method, params) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = (await response.json()) as { result?: unknown; error?: { message?: string } };
    if (json.error || json.result === undefined || json.result === null) {
      throw new Error(json.error?.message ?? `no answer to ${method}`);
    }
    return json.result;
  };
}

const toHex = (n: number) => `0x${n.toString(16)}`;
const toNumber = (hex: string) => Number(BigInt(hex));

/** The name in a LabelRegistered log, whose data is (string label, address owner, uint64 expiry). */
export function labelOf(data: string): string {
  const hex = data.replace(/^0x/, "");
  const offset = toNumber(`0x${hex.slice(0, 64)}`) * 2;
  const length = toNumber(`0x${hex.slice(offset, offset + 64)}`);
  const bytes = hex.slice(offset + 64, offset + 64 + length * 2);
  if (bytes.length !== length * 2) throw new Error("not a LabelRegistered log");
  return new TextDecoder().decode(Uint8Array.from(bytes.match(/../g) ?? [], (byte) => parseInt(byte, 16)));
}

/** Where to start: the block before the deployment. */
export function freshState(startBlock: number): ScanState {
  return { block: startBlock - 1, names: 0, recent: [] };
}

/**
 * Reads the registrations after `state.block`, up to the chain's head or until `deadline` (in ms),
 * whichever comes first; the next call carries on from there. Narrows its ranges if the RPC
 * refuses wide ones.
 */
export async function scan(
  state: ScanState,
  options: { rpc: Rpc; registry: string; deadline: number; chunk?: number },
): Promise<ScanState & { behind: boolean }> {
  const { rpc, registry, deadline } = options;
  const latest = (await rpc("eth_getBlockByNumber", ["latest", false])) as { number: string; timestamp: string };
  const head = toNumber(latest.number);
  const headTime = toNumber(latest.timestamp);
  let { block, names } = state;
  const recent = [...state.recent];
  let chunk = options.chunk ?? 25_000;
  while (block < head && Date.now() < deadline) {
    const to = Math.min(head, block + chunk);
    let logs: RegistrationLog[];
    try {
      logs = (await rpc("eth_getLogs", [
        { address: registry, topics: [LABEL_REGISTERED], fromBlock: toHex(block + 1), toBlock: toHex(to) },
      ])) as RegistrationLog[];
    } catch (error) {
      if (chunk > 500) {
        chunk = Math.floor(chunk / 5);
        continue;
      }
      throw error;
    }
    // Oldest first, so the newest ends up at the front.
    for (const log of logs) {
      names += 1;
      const at = log.blockTimestamp
        ? toNumber(log.blockTimestamp)
        : headTime - (head - toNumber(log.blockNumber)) * BLOCK_SECONDS;
      try {
        recent.unshift({ label: labelOf(log.data), block: toNumber(log.blockNumber), at });
      } catch {
        // Counted, but not shown.
      }
    }
    block = to;
  }
  const dayAgo = headTime - DAY;
  return { block, names, recent: recent.filter((r, i) => i < 10 || r.at > dayAgo).slice(0, 5000), behind: block < head };
}

/** Words that keep a name out of the homepage's list of latest names. It still counts. */
const HIDDEN = [
  "airdrop", "admin", "bitch", "cock", "claim", "cunt", "dick", "drain", "fag", "free", "fuck", "giveaway", "hitler",
  "http", "kike", "metamask", "nazi", "nigg", "official", "pedo", "porn", "pussy", "rape", "retard", "scam", "sex",
  "shit", "slut", "spic", "support", "verify", "wallet", "whore", "www",
];

/** Whether a name may appear on the homepage: plain letters, digits and hyphens, and nothing rude. */
export function showable(label: string): boolean {
  return /^[a-z0-9-]{3,20}$/.test(label) && !HIDDEN.some((word) => label.includes(word));
}

/** The numbers for the homepage, as of `now` (unix seconds). */
export function summarise(state: ScanState, now: number): LiveStats {
  return {
    live: true,
    names: state.names,
    last24h: state.recent.filter((r) => r.at > now - DAY).length,
    latest: state.recent
      .filter((r) => showable(r.label))
      .slice(0, 6)
      .map(({ label, at }) => ({ label, at })),
  };
}

/** "just now", "5 min ago", "3 hours ago", "2 days ago". */
export function timeAgo(at: number, now: number): string {
  const seconds = Math.max(0, now - at);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < DAY) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  const days = Math.floor(seconds / DAY);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
