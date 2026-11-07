// Site-wide settings.

/** False until the contracts are live: buying is shown as "opens at launch". */
export const LAUNCHED = false;

/** Which deployment this build shows (src/deployment.ts): set VITE_NETWORK=testnet for a testnet copy. */
export const NETWORK: "mainnet" | "testnet" = import.meta.env.VITE_NETWORK === "testnet" ? "testnet" : "mainnet";

export const GITHUB_URL = "https://github.com/mitchrobertshaw/hex-names";
