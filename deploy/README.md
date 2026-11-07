# Deploying .hex

.hex goes on two chains, in three steps that you run from GitHub's website. Rehearse on the
testnets first, then do it for real on mainnet.

| | Testnets (the rehearsal) | Mainnet (for real) |
|---|---|---|
| PulseChain side | PulseChain Testnet v4 | PulseChain |
| Ethereum side | Sepolia, Ethereum's testnet | Ethereum |
| Joined by | PulseChain's testnet bridge | the official PulseChain bridge |
| Coins | free, from faucets | real PLS and ETH |
| GitHub environment holding the key | `testnet` | `deploy` |

The testnet bridge joins Sepolia and PulseChain Testnet v4 the way the real bridge joins Ethereum
and PulseChain, with the same contracts and the same timings. So the testnets rehearse all of it:
both chains, the bridge and the bot.

## What goes where

**Yes, you deploy on Ethereum too.** Names live on PulseChain, but half of .hex is on Ethereum: the
copy of every name, so Ethereum apps and wallets can look names up, and the order book, so people
can buy from Ethereum. Without it, names would work only on PulseChain.

| Step | Chain | What it does | Guide |
|---|---|---|---|
| 1 | PulseChain | Deploys the `.hex` registry where names live, the registrar and its prices, `AnyTokenCheckout`, `HexOrderFiller`, `HexMirrorSync` and the lookups, and sets aside the [reserved names](../README.md#reserved-names) | [PulseChain](pulsechain/README.md#step-1-deploy-on-pulsechain) |
| 2 | Ethereum | Deploys the Ethereum copy of `.hex` and its lookups, `HexMirrorRegistrar` and `HexOrderBook`, and links them to step 1's contracts | [Ethereum](ethereum/README.md#step-2-deploy-on-ethereum-and-link-it) |
| 3 | PulseChain | Links step 1's contracts to step 2's. Then .hex is live | [PulseChain](pulsechain/README.md#step-3-link-pulsechain) |

The scripts are split the same way, in [`script/pulsechain/`](../script/pulsechain) and
[`script/ethereum/`](../script/ethereum), as are the contracts in [`src/`](../src).

## 1. Get ready

Do this once for the testnets, and again for mainnet.

1. **Make a deployer wallet**: a new one, used for nothing else. In MetaMask or Rabby, add an
   account, then copy its private key from the account's details. Use one for the testnets and
   another for mainnet. Each network's three steps must use the same one: only the wallet that ran
   step 1 can link the chains, and only once. After step 3 it has no powers left, and you can empty
   it.

2. **Fund it.**

   | | Testnets | Mainnet |
   |---|---|---|
   | On PulseChain, for steps 1 and 3 | 10 tPLS: one request at [faucet.v4.testnet.pulsechain.com](https://faucet.v4.testnet.pulsechain.com) | about 50,000 PLS |
   | On Ethereum, for step 2 | 0.01 Sepolia ETH, from a [faucet](ethereum/README.md#sepolia-eth) | about 0.02 ETH |

   On the testnets it costs about 0.03 tPLS and 0.0015 Sepolia ETH. On mainnet it cost about
   28,500 PLS and 0.0023 ETH on 5 November 2026, and less at today's gas prices; the rest is a cushion
   in case they rise. Send back what's left afterwards.

3. **Put its key in GitHub.** In the repo: Settings, Environments, New environment. Name it `testnet`
   (or `deploy` for mainnet), then add an environment secret named `DEPLOYER_PRIVATE_KEY` holding
   the private key. For `deploy`, also tick "Required reviewers" and add yourself, so a mainnet run
   waits for your go-ahead.

4. **Choose the admin.** It can later raise or lower prices, change the payment tokens, add
   registrars and hand held reserved names to their owners. It can never take, move or unregister
   anyone's name ([who can do what](../README.md#who-can-do-what)). It must be a plain wallet or a
   Safe: not a wallet that's been upgraded to a "smart account", and not the deployer, whose key
   sits in GitHub. On mainnet, use a Safe. On the testnets, any wallet of yours will do.

5. **Check the reserved names** in [`script/reserved-names.csv`](../script/reserved-names.csv).
   Step 1 sets them aside.

## 2. Testnets only: USDC from Sepolia

On mainnet, names are paid for in USDC bridged from Ethereum. On the testnets they're paid for in
Circle's test USDC bridged from Sepolia, which the testnet bridge calls "USDC from Sepolia". That
copy appears the first time someone bridges the token, and on 7 November 2026 nobody had. Until
someone does, step 1 stops with "USDC isn't on PulseChain Testnet v4 yet".

You'll want some anyway, to buy names and for the bot's float. So, once:

1. Get test USDC on Sepolia at [faucet.circle.com](https://faucet.circle.com) (choose Ethereum
   Sepolia).
2. Bridge 50 or so to PulseChain Testnet v4 at
   [bridge.v4.testnet.pulsechain.com](https://bridge.v4.testnet.pulsechain.com).
3. Wait about 15 to 20 minutes, until it arrives.

Step by step: [USDC from Sepolia](pulsechain/README.md#testnets-usdc-from-sepolia).

## 3. Deploy: three steps

For each step: on GitHub, Actions, **deploy**, Run workflow. Choose the network and the step, and
fill in the fields that step needs. Leave **Send it for real** unticked the first time: that's a dry
run, which checks everything and sends nothing. If its summary looks right, run it again ticked.

Each run's summary (open the run and scroll down) shows the addresses the next steps and the bot
need, and what the step costs. Copy them somewhere safe. Each real run also keeps a full record
under Artifacts.

| Step | Fill in | It gives you |
|---|---|---|
| 1. Deploy on PulseChain | Admin, and optionally who receives payments (the admin if left empty) | `PULSECHAIN_MIRROR_SYNC`, `PULSECHAIN_ORDER_FILLER`, `PULSECHAIN_REGISTRAR`, `PULSECHAIN_HEX_REGISTRY`, `PULSECHAIN_USDC`, `START_BLOCK_PULSECHAIN` and the lookup addresses |
| 2. Deploy on Ethereum and link it | Admin (the same), `PULSECHAIN_MIRROR_SYNC`, `PULSECHAIN_ORDER_FILLER` | `ETHEREUM_MIRROR_REGISTRAR`, `ETHEREUM_ORDER_BOOK`, `START_BLOCK_ETHEREUM` and the lookup addresses |
| 3. Link PulseChain | All four `PULSECHAIN_` and `ETHEREUM_` addresses | "Linked. .hex is live" |

Each takes 5 to 10 minutes. The details for each chain:

- [PulseChain: steps 1 and 3](pulsechain/README.md)
- [Ethereum: step 2](ethereum/README.md)

Steps 2 and 3 check the other chain before linking, and refuse if anything doesn't match: another
network, another deployer key, addresses from different runs, or contracts that are already linked.

## 4. Run the bot

The bot fills orders placed on Ethereum, claims the bridge messages that keep Ethereum's copy up to
date, and copies changes made outside the checkouts over to Ethereum. Without it, names still work
on PulseChain, but the Ethereum copy falls behind and orders from Ethereum get refunded instead of
filled.

On the testnets, your own computer will do while you test. On mainnet it must run all the time:
on a small server (a $5 VPS, Railway, Fly.io) or a computer that stays on.

1. **Give it a wallet**, a new one. It has the same address on both chains. Fund it:

   | | Testnets | Mainnet |
   |---|---|---|
   | PulseChain, for gas | 10 tPLS (the faucet) | 50,000 PLS |
   | PulseChain, to pay for the names it registers | 20 to 50 USDC from Sepolia | $100 to $500 of USDC bridged from Ethereum |
   | Ethereum, to claim bridge messages | 0.01 Sepolia ETH | 0.01 ETH |

   Orders pay it back in USDC on Ethereum (or Sepolia). Move that back to PulseChain now and then.

2. **Install it** on that computer, with [Node.js](https://nodejs.org) 22 or later. Get the code
   (git clone, or Code, Download ZIP on GitHub), then in its `bot` folder:

   ```bash
   npm ci
   ```

   ```bash
   npm run keygen
   ```

   That prints `BOT_ENCRYPTION_SECRET_KEY` and a public key. Buyers on Ethereum seal their order to
   the public key, so only the bot can read which name they're buying. The website will need the
   public key.

3. **Fill in its settings:**

   ```bash
   cp .env.example .env
   ```

   Then in `.env`: `NETWORK` (`testnet` or `mainnet`), `BOT_PRIVATE_KEY`, the
   `BOT_ENCRYPTION_SECRET_KEY` from keygen, and the addresses and start blocks from the step
   summaries. On the testnets, also `PULSECHAIN_USDC` from step 1. Use a separate `.env`, wallet and
   `STATE_FILE` for each network.

4. **Start it:**

   ```bash
   npm start
   ```

   It prints its wallet, its network and the public key, then keeps going. Leave it running.

## 5. Check it works

Straight away:

- Every step's summary ends with "ONCHAIN EXECUTION COMPLETE & SUCCESSFUL", and step 3's says
  "Linked. .hex is live".
- On the explorers ([PulseChain Testnet v4](https://scan.v4.testnet.pulsechain.com),
  [Sepolia](https://sepolia.etherscan.io)), every transaction from the deployer wallet succeeded.
- When the bot first starts, it copies the reserved names that have a wallet to Ethereum. Its log
  shows "yourfriendsommi.hex changed on PulseChain; copy sent to Ethereum". About 15 minutes later,
  once the bridge has signed it: "bridge message … from HexMirrorSync claimed on Ethereum".

Then try the app on the testnets. Fill in `testnet` in
[`web/src/deployment.ts`](../web/src/deployment.ts) from the step summaries and the bot's public
key, and run a copy of the site with `VITE_NETWORK=testnet` (on Netlify, a second site or a branch
with that environment variable). The app is at `/app` on it:

- [ ] Buy a name on PulseChain Testnet v4 with USDC. It's yours in about two minutes, and on Sepolia
      about 15 minutes later.
- [ ] Order a name from Sepolia, paying in USDC or Sepolia ETH. The bot registers it on PulseChain
      within about a minute and a half, and is paid on Sepolia about 15 minutes later.
- [ ] Order a name someone already has. The bot refunds it over the bridge.
- [ ] Look names up on both chains, then transfer one on PulseChain and watch Sepolia follow.
- [ ] Stop the bot, order a name, and take the money back yourself 6½ hours later.

## 6. Mainnet

When everything above has worked on the testnets, and someone other than the author has reviewed
the contracts:

1. Make a new deployer wallet, put its key in the `deploy` environment (with yourself as a required
   reviewer), and fund it.
2. Make the admin a Safe.
3. Run steps 1, 2 and 3 with **Mainnet: PulseChain + Ethereum**.
4. Verify the contracts on the block explorers. Sourcify, which both explorers read, covers
   PulseChain, Ethereum and Sepolia, but not PulseChain Testnet v4.
5. Start the bot on its server, with its float.
6. Fill in `mainnet` in [`web/src/deployment.ts`](../web/src/deployment.ts) from the step
   summaries and the bot's public key. That switches on buying in the app and the live numbers
   on the homepage. Add `app.hexns.domains` to the Netlify site, then launch.

Sepolia already has Ethereum's next upgrade, which makes creating contracts about 7 times dearer in
gas. When Ethereum gets it too, update Foundry in the deploy workflow before step 2 (see
[Ethereum](ethereum/README.md#mainnet)).

## If a step stops

Fix what it says, then run the same step again. Steps 1 and 2 start afresh each time; whatever a
stopped run deployed is simply never used.

| It says | What to do |
|---|---|
| USDC isn't on PulseChain Testnet v4 yet | Bridge some USDC from Sepolia first ([section 2](#2-testnets-only-usdc-from-sepolia)). |
| ADMIN is a contract that cannot hold ERC-1155 tokens | The admin is a smart account or another contract. Use a plain wallet or a Safe. |
| The wallet for name.hex is a contract that cannot hold ERC-1155 tokens | That reserved name's wallet can't hold the name. Leave its wallet empty to hold it instead. |
| Add the DEPLOYER_PRIVATE_KEY secret | The network's environment (`testnet` or `deploy`) has no key yet. |
| step 1 used a different deployer key | Run every step of a network with the same key. |
| step 1 was deployed for a different Ethereum network | Choose the same network for all three steps. |
| the two addresses are from different deployments | Copy both addresses from the same step 1 summary. |
| already linked | That step is already done. If step 3 stopped halfway, one of its two links went through; ask for help linking the other. |
| Insufficient funds | Top up the deployer wallet. |
