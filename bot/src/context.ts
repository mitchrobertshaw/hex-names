// Clients for both chains and the bot's wallet.

import { type Account, type Address, type Chain, type PublicClient, type Transport, type WalletClient, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, pulsechain } from "viem/chains";

import type { Config } from "./config.ts";
import { encryptionKeyPair } from "./reveal.ts";
import type { State } from "./state.ts";

export type Context = {
  config: Config;
  state: State;
  account: Account;
  payee: Address;
  encryption: { publicKey: `0x${string}`; secretKey: Uint8Array };
  pls: PublicClient<Transport, Chain>;
  plsWallet: WalletClient<Transport, Chain, Account>;
  eth: PublicClient<Transport, Chain>;
  ethWallet: WalletClient<Transport, Chain, Account>;
  log: (message: string) => void;
};

export function createContext(config: Config, state: State): Context {
  const account = privateKeyToAccount(config.botPrivateKey);
  const plsTransport = http(config.pulsechainRpcUrl, { retryCount: 3 });
  const ethTransport = http(config.ethereumRpcUrl, { retryCount: 3 });
  return {
    config,
    state,
    account,
    payee: config.payee ?? account.address,
    encryption: encryptionKeyPair(config.encryptionSecretKey),
    pls: createPublicClient({ chain: pulsechain, transport: plsTransport }),
    plsWallet: createWalletClient({ account, chain: pulsechain, transport: plsTransport }),
    eth: createPublicClient({ chain: mainnet, transport: ethTransport }),
    ethWallet: createWalletClient({ account, chain: mainnet, transport: ethTransport }),
    log: (message) => console.log(`${new Date().toISOString()} ${message}`),
  };
}
