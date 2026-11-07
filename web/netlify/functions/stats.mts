// GET /api/stats?network=mainnet|testnet: the homepage's live numbers (src/lib/stats.ts).
//
// Each call reads the blocks since the last one from the .hex registry on PulseChain, keeps its
// place in Netlify Blobs, and answers. Netlify's CDN keeps each answer for a minute, so the chain
// is read at most about once a minute however many people visit.

import { getStore } from "@netlify/blobs";

import { DEPLOYMENTS, type Network } from "../../src/deployment";
import { type ScanState, freshState, jsonRpc, scan, summarise } from "../../src/lib/stats";

export default async (request: Request): Promise<Response> => {
  const network: Network = new URL(request.url).searchParams.get("network") === "testnet" ? "testnet" : "mainnet";
  const deployment = DEPLOYMENTS[network];
  if (!deployment) return reply({ live: false }, 300);

  const store = getStore("hexns-stats");
  const key = `${network}-${deployment.registry.toLowerCase()}`;
  const saved = (await store.get(key, { type: "json" })) as ScanState | null;
  let state = saved ?? freshState(deployment.startBlock);
  let behind = false;
  try {
    const read = await scan(state, { rpc: jsonRpc(deployment.rpc), registry: deployment.registry, deadline: Date.now() + 6000 });
    state = { block: read.block, names: read.names, recent: read.recent };
    behind = read.behind;
    await store.setJSON(key, state);
  } catch {
    // The RPC is down: answer with what we had, briefly.
    if (!saved) return reply({ live: false }, 30);
    return reply(summarise(state, Math.floor(Date.now() / 1000)), 30);
  }
  // Still catching up with the chain: ask again soon.
  return reply(summarise(state, Math.floor(Date.now() / 1000)), behind ? 10 : 60);
};

function reply(body: unknown, seconds: number): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": `public, durable, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`,
      "Netlify-Vary": "query=network",
    },
  });
}

export const config = { path: "/api/stats" };
