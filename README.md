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
- **Payment.** Paid in USDC or DAI bridged from Ethereum, straight to the beneficiary set at
  deployment, which can never change (the deploy workflow fills in the project owner's wallet).

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
- **Bot tests** (`bot/test/`): 20 tests, including hashes checked against the deployed contracts, a
  real bridge message, and each network's settings.

With [Foundry](https://getfoundry.sh) and git:

```bash
./install-deps.sh
```

```bash
forge test
```

## Deploying without installing anything

**The guide is in [`deploy/`](deploy/README.md)**: what GitHub, Railway and Netlify each do, what
you do, and a page for each chain, the bot and the website. All of it happens in a browser. In
short: three steps, run from the GitHub website (a phone works too), first on the testnets
(PulseChain Testnet v4 and Sepolia), then on mainnet.

1. **Deploy on PulseChain** ([`script/pulsechain/`](script/pulsechain)): the `.hex` registry,
   registrar and checkout, the bridge contracts, and the [reserved names](#reserved-names).
2. **Deploy on Ethereum and link it** ([`script/ethereum/`](script/ethereum)): the Ethereum copy of
   `.hex`, and the order book for buying from Ethereum.
3. **Link PulseChain** ([`script/pulsechain/`](script/pulsechain)): after this, nothing can change
   the links.

Each runs from Actions > deploy > Run workflow, as a dry run first. A new wallet, just for
deploying, pays for them: about 10 tPLS and 0.01 Sepolia ETH from faucets on the testnets, and about
50,000 PLS and 0.02 ETH on mainnet. Its key goes in a GitHub repository secret, one per network
(`DEPLOYER_PRIVATE_KEY_TESTNET`, `DEPLOYER_PRIVATE_KEY_MAINNET`), and it has no powers left once the
three steps are done. A real mainnet run also needs `mainnet` typed into the workflow's confirm box.
The admin must be a plain wallet, a hardware wallet or a Safe, since it is given the (powerless)
`hex` token. Each step checks the other chain's contracts before linking to them, and refuses if
something doesn't match.

## Running the bot

The bot in [`bot/`](bot) fills Ethereum orders, claims bridge messages on Ethereum, and copies name
changes to Ethereum. It needs to run all the time. It runs on [Railway](https://railway.com), set up
in a browser, with a `testnet` environment for the rehearsal and `production` for mainnet. Step by
step: [the bot, on Railway](deploy/bot/README.md).

1. Give it a wallet with PLS for gas and a float of USDC on PulseChain (say $100–$500), plus a
   little ETH on Ethereum for claims (a few cents each at today's gas prices).
2. Paste its settings into Railway: `NETWORK`, its private key (sealed), and the **For the bot**
   lines from the deploy run summaries. Its order encryption key is made from its wallet key, and it
   prints the public key, for websites, when it starts.
3. Give it a Railway volume, where it remembers its place between restarts.

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

- Paying referrers. Purchases and renewals made through a referral link already record the
  referrer on-chain ([`web/README.md`](web/README.md#the-app)). During the launch offer, the first
  58 days after launch, referrers earn 10% of what the buyers they bring pay. A report of what each
  referrer is owed, to pay them from, is next.
- Phone wallets by QR code (WalletConnect) in the app at app.hexns.domains. Browser wallets work.
- Primary names (showing `alice.hex` for an address), and renewing or transferring from Ethereum.
  For now, names are managed on PulseChain, and anyone can renew any name there.
- Wallet support: wallets look up ENS out of the box but need adding `.hex`, for example as a
  MetaMask Snap. What to have ready, and who to ask: [docs/WALLET_CHECKLIST.md](docs/WALLET_CHECKLIST.md).
- Verifying the contracts on the block explorers (publishing their source code) from the deploy
  workflow.
- A button in the app to take back an Ethereum order the bot never filled. The order book allows it
  6½ hours after ordering. While the bot runs, it refunds such orders by itself.
- A review by someone other than the author.

## License

MIT. See [LICENSE](LICENSE).
