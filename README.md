# hex-names

`.hex` names that work on both PulseChain and Ethereum, bought in a few clicks from either chain.

Built on [ENSv2](https://github.com/ensdomains/contracts-v2), the next version of the Ethereum Name
Service, at its audited commit. A `.hex` name lives on PulseChain and is copied to Ethereum
automatically, so one purchase covers both chains. Every name resolves to its owner's address on
both chains from the moment it is registered.

> **Status:** unaudited and not deployed. ENSv2 itself has been audited, but the small patch that
> runs it on PulseChain and the contracts in `src/` have not. Don't put real money through them
> until someone other than their author has reviewed them.

> **`.hex` names never end in `.eth`.** `alice.hex` and `alice.hex.eth` are different names. This
> project doesn't control `hex.eth`, so whoever does decides where `alice.hex.eth` points. When
> sending to someone's `.hex` name, type it exactly as `name.hex`.

## Is `.hex` free?

Yes, as of 5 November 2026. Checked on-chain: ENS on Ethereum has no `.hex` ending, Pulse Domains
on PulseChain has none (of the 1,163 endings it has created), nor does the copy of ENS PulseChain
inherited at its fork, Unstoppable Domains, or Decentraweb. `.hex` is not an internet domain ending,
and nobody applied for it in ICANN's 2026 round, so it cannot reach ENS through the DNS route
either.

## Buying a name

| From | Clicks | The name is yours | On the other chain |
|---|---|---|---|
| PulseChain | 2–3 (approve, commit, register) | about 1–2 minutes | on Ethereum about 15 minutes later |
| Ethereum | 1–2 (approve if paying in a token, place order) | about 1½ minutes | it lives on PulseChain from the start |

Either way the buyer can pay with any token that has a pool (PLS, HEX, PLSX, ETH, USDC, DAI, ...).
It is swapped into a dollar stablecoin, so prices stay in dollars without a price oracle.

### From PulseChain

1. **Commit.** The wallet commits to the name with a hash of its details. Nothing is paid yet, and
   nobody watching can see which name it is.
2. **Wait** one minute.
3. **Register** through `AnyTokenCheckout` with any token or PLS. It swaps to USDC on PulseX, pays the
   registrar exactly the price, returns the change, and sends the name to Ethereum.

### From Ethereum

1. **Place an order** in `HexOrderBook`, paying in USDC, ETH, HEX or any token with a Uniswap pool.
   The order holds only the commitment, plus the name's details sealed so only the bot can read
   them. Nobody watching Ethereum can see which name it is and take it first.
2. **The bot registers the name** on PulseChain to the buyer within about a minute and a half,
   paying from its own float of stablecoins.
3. **The bridge settles.** About 15 minutes later the official PulseChain bridge confirms the
   registration on Ethereum, and the order's money goes to the bot. Nobody waits on this step.

If the name can't be registered (someone took it first, or it isn't for sale), or the bot doesn't
fill it within the 30-minute fill window, the bot refunds the order over the bridge. If the bot
isn't running at all, the buyer can take the money back themselves, 6 hours after the fill window
closes.

### Why there's a bot

The official bridge waits until the sending chain has made a transaction irreversible. That takes
about 13 minutes on Ethereum and 11 on PulseChain. Timed over its last 25 messages each way on
5 November 2026:

| Direction | Fastest | Typical | Slowest |
|---|---|---|---|
| Ethereum → PulseChain | 13.5 min | 17.4 min | 19.8 min |
| PulseChain → Ethereum (until it can be claimed) | 10.8 min | 13.3 min | 15.2 min |

So the bot does what LibertySwap does: it acts within seconds and lets the bridge catch up. Unlike
LibertySwap, it gets no special powers. It buys names like anyone else, and the money it is owed
is released only by the bridge.

## How names work on both chains

- **Where names live.** Names live in an ENSv2 registry on PulseChain. That's where they're bought,
  renewed and transferred.
- **The Ethereum copy.** Every change is copied to an identical ENSv2 registry on Ethereum by bridge
  messages, which the bot claims on Ethereum. Copies on Ethereum can't be transferred; they follow
  PulseChain.
- **Addresses.** By default a name resolves to its owner's address, for Ethereum (coin type 60),
  PulseChain (ENSIP-11 coin type `0x80000171`) and any EVM chain's default (ENSIP-19). This is the
  `OwnerResolver` set on `.hex` itself.
- **Records.** Owners who want other records (other addresses, text, avatar, a website) point their
  name at their own ENSv2 resolver, on either chain.
- **Lookups.** Apps look names up through ENSv2's `UniversalResolverV2` on either chain, the same
  way they look up ENS names.

One caveat: a smart-contract wallet may not control the same address on the other chain. Owners
using one should set their own resolver. The same goes for wallets with an EIP-7702 delegation that
can't hold ERC-1155 tokens: their Ethereum copy is skipped, but the name still works on PulseChain.

## Prices

| Length | A year |
|---|---|
| 5 or more characters | $10, for both chains |
| 4 | $160 |
| 3 | $640 |
| 1–2 | not for sale |

- **Multi-year discounts** (ENS's): 12.5% off from 2 years, 31.25% from 3, 43.75% from 6.
- **Expired names.** A name that expires has a 28-day grace period for its owner to renew. After
  that it can be bought again, starting at a $100 million premium that halves every day for 21 days,
  so nobody can snipe a name the moment it lapses.
- **Payment.** Paid in USDC or DAI bridged from Ethereum, to the beneficiary set at deployment.

## Reserved names

Some names are set aside when .hex is deployed, before anyone can buy names. They're listed in
[`script/reserved-names.csv`](script/reserved-names.csv), one per row: the name, optionally a
wallet, and a note.

- **With a wallet**, the name belongs to that wallet from the start, as if they had bought it. Only
  use a wallet you're sure is theirs, such as the one their own `.eth` or `.pls` name points to.
- **Without a wallet**, the name is held. Nobody can buy it and it points nowhere, until its owner
  proves who they are and the admin hands it to their wallet.

Either way it lasts 5 years from deployment. After that a given name is renewed like any other, and
a held name nobody claimed goes on sale. The admin can extend either. Given names reach the Ethereum
copy on the bot's first run, as long as its `START_BLOCK_PULSECHAIN` is the block step 1 was
deployed in.

**Adding names.** Edit the file on GitHub before deploying (open it, then the pencil icon). One name
per row, without `.hex`: a–z, 0–9 and hyphens, at least 3 characters. Leave the wallet empty to hold
a name, and keep commas out of the note. The tests and the deploy check every row and stop at the
first one that's wrong.

**Handing over a held name.** Once you're sure who it belongs to (for example, they sign a message
with the wallet their `.eth` or `.pls` name points to), the admin calls `register` on the .hex
registry with:

| Field | Value |
|---|---|
| `label` | the name, e.g. `pulsechain` |
| `owner` | their wallet |
| `registry` | `0x0000000000000000000000000000000000000000` |
| `resolver` | `0x0000000000000000000000000000000000000000` (the default: it points to its owner) |
| `roleBitmap` | `97409655027181761882228017414928043058140282880` (the rights a buyer gets) |
| `expiry` | `0` (keeps the reservation's expiry) |

This works only on held names: the admin can't take a name someone owns. A page that does it for
you can come with the website.

## Who can do what

**Nobody can** take, unregister, or redirect someone's name on PulseChain. That includes the admin
and the deployer. The registry has no role that can, and the tests check it. Nobody can replace the
`.hex` registry or its default resolver on either chain: `.hex` is registered in each root with no
roles at all.

**The admin** (PulseChain only) can raise or lower all prices together, change the accepted
stablecoins, add registrars and renewers, hand held reserved names to their owners, and add other
endings to the root. It can't change the price of one length, the multi-year discounts or the
premium for expired names: those are fixed when the registrar is deployed. A new registrar can only
register names nobody owns. Use a multisig such as a Safe, or give these powers up once things are
settled.

**The bridge's validators** (5 of 8 must sign) are trusted for two things: the Ethereum copy, and
releasing money held by Ethereum orders. If they were compromised they could write a false Ethereum
copy, or redirect money held by open orders. They could never touch the real names on PulseChain.
Every token bridged to PulseChain relies on the same validators.

**The bot** affects only speed. A stolen bot key loses only the bot's own float. If the bot stops,
orders from Ethereum are refunded instead of filled.

**Nothing else has an owner.** `AnyTokenCheckout`, `HexOrderFiller`, `HexMirrorSync`,
`HexOrderBook` and `HexMirrorRegistrar` have no admin functions, no upgrades and no pause. Each
bridge contract is linked once, by the deployer, to its partner on the other chain. After that,
nothing can change.

## The contracts

| PulseChain | What it is |
|---|---|
| ENSv2 `PermissionedRegistry` ×2 | the root registry, and the `.hex` registry where names live |
| ENSv2 `ETHRegistrar` + `StandardRentPriceOracle` | the `.hex` registrar and its prices |
| ENSv2 `UniversalResolverV2`, `PermissionedResolver`, `VerifiableFactory`, `LabelStore`, `ContractNamer` | lookups, owners' own resolvers, and supporting contracts |
| [`OwnerResolver`](src/common/OwnerResolver.sol) | the default resolver: a name resolves to its owner |
| [`AnyTokenCheckout`](src/pulsechain/AnyTokenCheckout.sol) | buy or renew with any token or PLS, as for .pdai |
| [`HexOrderFiller`](src/pulsechain/HexOrderFiller.sol) | completes Ethereum orders and tells Ethereum over the bridge |
| [`HexMirrorSync`](src/pulsechain/HexMirrorSync.sol) | sends a name's owner and expiry to Ethereum over the bridge |

| Ethereum | What it is |
|---|---|
| the same ENSv2 contracts | the Ethereum copy of `.hex` and its lookups |
| [`HexMirrorRegistrar`](src/ethereum/HexMirrorRegistrar.sol) | the only writer of the Ethereum copy, from bridge messages |
| [`HexOrderBook`](src/ethereum/HexOrderBook.sol) | orders from Ethereum, and the money held for them |

**Running ENSv2 on PulseChain.** PulseChain lacks the opcodes from Ethereum's March 2024 upgrade
(`TSTORE`, `MCOPY`). So everything is compiled for the previous target, Shanghai, with the compiler
and settings ENS deploys with (solc 0.8.25, 1,000 optimizer runs). Two changes make that work, and
the same bytecode then runs on both chains:

- ENSv2 swaps the ENS library's memory copy for an `mcopy` version. Here the library's own
  word-by-word copy is used instead.
- One function in `PermissionedResolver` used `mcopy` directly. The patch replaces it with that same
  library copy, a few lines: [`patches/ensv2-shanghai.patch`](patches/ensv2-shanghai.patch).

The compiled contracts were scanned and contain none of the missing opcodes.

## Running the tests

Nothing needs installing on your own computer: GitHub runs everything on every push (Actions tab,
workflow **test**).

- **Unit tests** (`test/unit/`): 92 tests that run both chains side by side, with the real ENSv2
  contracts and a stand-in bridge. They cover:
  - prices and roles, and that nobody can take a name;
  - reserved names, given or held, handing a held one over, and the list file;
  - buying with every kind of payment;
  - the whole Ethereum order flow, and every way it can be refunded;
  - that a buyer can never get both the name and a refund, and that a filler can't claim the wrong
    order;
  - the Ethereum copy following transfers, renewals and expiry;
  - forged and out-of-order bridge messages.
- **Fork tests** (`test/fork/`): 8 tests against live copies of PulseChain and Ethereum. They use the
  real bridge contracts, PulseX, Uniswap, USDC, DAI, PLS, ETH and HEX on both chains.
- **Bot tests** (`bot/test/`): 15 tests, including hashes checked against the deployed contracts and
  a real bridge message.

With [Foundry](https://getfoundry.sh) and git:

```bash
./install-deps.sh
```

```bash
forge test
```

## Deploying without installing anything

Three steps, run from the GitHub website (a phone works too).

1. **Make a new wallet just for deploying.** Send it about 50,000 PLS on PulseChain and 0.01 ETH
   on Ethereum. On 5 November 2026 deploying cost about 28,500 PLS and 0.0023 ETH. Don't use your
   main wallet. Once the three steps are done this key has no power, and you can empty it.
2. **Add its key as a secret.** In the repo: Settings > Environments > New environment, name it
   `deploy`, and add a secret `DEPLOYER_PRIVATE_KEY`. On the same page you can require your own
   approval before each run.
3. **Run the three steps** from Actions > deploy > Run workflow. Do each as a dry run first (leave
   **broadcast** unticked), then for real. Each run's summary shows the addresses the next step
   needs.
   1. **Deploy on PulseChain.** Enter the admin wallet, and optionally who receives payments.
      This also sets aside the [reserved names](#reserved-names), so check that list first.
   2. **Deploy on Ethereum and link it.** Enter the admin and the two `PULSECHAIN_...` addresses from
      step 1.
   3. **Link PulseChain.** Enter all four addresses.

The admin must be a plain wallet or a Safe, since it is given the (powerless) `hex` token. Each step
checks the other chain's contracts before linking to them, and refuses if something doesn't match.

## Running the bot

The bot in [`bot/`](bot) fills Ethereum orders, claims bridge messages on Ethereum, and copies name
changes to Ethereum. It needs to run all the time, on a small server (a $5 VPS, Railway, Fly.io) or
a computer that stays on.

1. Give it a wallet with PLS for gas and a float of USDC on PulseChain (say $100–$500), plus a
   little ETH on Ethereum for claims (a few cents each at today's gas prices).
2. `npm ci`, then `npm run keygen` for the key that unseals orders. Publish the public key for
   websites to use.
3. Copy `bot/.env.example` to `bot/.env`, fill it in from the deploy summaries, then `npm start`.

The money from orders arrives in USDC on Ethereum, while the float is spent on PulseChain. Move it
back across now and then, through the official bridge or LibertySwap.

`npm run check-claim` checks the bot can claim real bridge messages. It finds one on the live bridge
that has been signed but not yet claimed, and simulates claiming it. Nothing is sent.

## For websites

- **On PulseChain:**
  1. Get the price with `AnyTokenCheckout.quoteRegister`.
  2. Commit with `registrar.commit(registrar.makeCommitment(...))`.
  3. After a minute, call `registerWithToken` or `registerWithPLS` with a 2% buffer.
- **On Ethereum:**
  1. Call `prepareOrder` from [`bot/src/buy.ts`](bot/src/buy.ts) with the bot's public key.
  2. Read the price from the PulseChain registrar.
  3. Call `HexOrderBook.placeOrder` (or `placeOrderWithETH` or `placeOrderWithToken`) for the price
     plus the bot's fee (25 cents by default).
- **Looking names up:** call `UniversalResolverV2.resolve` on either chain, for example with viem's
  `getEnsAddress` and the deployment's `universalResolverAddress`.
- **Names must be in ENS normal form** (lower case, ENSIP-15). `prepareOrder` and the bot refuse
  anything else.
- **Say that `.hex` names never end in `.eth`** wherever people type a name.

## Not done yet

- Buying and managing names on the website. The landing page and name search are in [`web/`](web),
  ready for Netlify; buying is switched on once the contracts are deployed.
- Primary names (showing `alice.hex` for an address), and renewing or transferring from Ethereum.
  For now, names are managed on PulseChain, and anyone can renew any name there.
- Wallet support: wallets look up ENS out of the box but need adding `.hex`, for example as a
  MetaMask Snap. What to have ready, and who to ask: [docs/WALLET_CHECKLIST.md](docs/WALLET_CHECKLIST.md).
- A review by someone other than the author.

## License

MIT. See [LICENSE](LICENSE).
