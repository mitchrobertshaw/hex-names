# How hex-names works

`.hex` names live in one registry on PulseChain. An Ethereum copy follows it automatically, and a
relayer carries changes between the two chains. Buyers pay once, on the chain they're on, with any
token. Wallets look names up through a MetaMask Snap and a small JavaScript library.

## Rules for users

- **`.hex` names never end in `.eth`.** `alice.hex` and `alice.hex.eth` are different names. This
  project doesn't own `hex.eth`, so `alice.hex.eth` is controlled by whoever does. Say this on the
  website, in the docs and in the Snap.
- **Price:** $5 a year for names of 5 or more characters, with no multi-year discount. 3 and 4
  character names cost more (placeholders copied from ENS until decided), and 1 or 2 character
  names can't be registered.
- **Expiry:** a name that isn't renewed can still be renewed by its owner for 28 days. After that
  it's released, and for 21 days it costs extra, falling by half each day, which stops people
  grabbing expired names the moment they lapse.
- **Renewing on PulseChain covers both chains.** A name that isn't renewed expires on both.

## The pieces

| Piece | Where | What it does | Status |
|---|---|---|---|
| Registry | PulseChain | The source of truth. Buying, renewing, selling and setting addresses happen here. Built from ENSv2, ported to PulseChain. | Built and tested |
| `AnyTokenCheckout` | PulseChain | Takes payment in PLS or any token with a PulseX pool, swaps it to DAI bridged from Ethereum, and pays the registrar exactly $5 plus the sync fee. | Built and tested |
| Ethereum copy | Ethereum | Follows the registry. Accepts only signed, numbered updates. Lets Ethereum contracts read names. | Next |
| Ethereum checkout | Ethereum | Lets someone pay from Ethereum without needing PLS. Takes a sealed name and refunds if the purchase isn't completed in time. | Not started |
| Relayer | Server | Does the commit step for buyers, copies changes to Ethereum, completes Ethereum purchases, and issues refunds. | Not started |
| MetaMask Snap | Wallet | Looks up `.hex` names when someone types one into MetaMask's send box, on PulseChain or Ethereum. | Not started |
| JavaScript library | Apps | The same lookups for any wallet, explorer or website. | Not started |
| Website | Web | Search, buy, renew and manage names. | Not started |

The two chains never talk to each other directly. The relayer carries every message between them.

## Buying a name

### On PulseChain

1. The buyer picks a name. The website's relayer immediately sends the sealed commitment (a hash of
   name, owner and secret) to the registrar, so the buyer doesn't have to.
2. About a minute later, the buyer clicks Buy and signs **one** transaction. Paying in PLS needs no
   approval. Other tokens need an approval first, or a free "permit" signature where the token
   supports it.
3. `AnyTokenCheckout` swaps the payment to DAI, pays the registrar, and returns the change.
4. The relayer copies the new name to Ethereum within a minute or two.

### From Ethereum

1. The buyer pays on Ethereum in ETH, USDC or DAI, in **one** transaction, sending only the sealed
   commitment. The name stays hidden, so nobody can spot it and claim it on PulseChain first.
2. The relayer sends the commitment to the PulseChain registrar. Once it has aged a minute, the
   buyer's browser passes the name to the relayer privately, and the relayer registers it.
3. The relayer copies the name back to Ethereum.
4. If the purchase isn't completed within the time limit, the buyer can reclaim their payment on
   Ethereum.

In both cases the buyer sees one all-in price before clicking: $5 plus a sync fee that covers the
gas on the other chain. Batching Ethereum updates keeps the sync fee small.

## Keeping the chains in step

- **Names only change on PulseChain.** The Ethereum copy accepts updates signed by the signing key
  and nothing else.
- **Every update is numbered per name.** The copy rejects anything older than what it already has,
  so an old update can't be replayed.
- **The relayer submits updates automatically,** in batches, within a minute or two of each change.
  Anyone can submit a signed update as a backup, so the copy still catches up if the relayer is
  down.
- **The copy trails PulseChain by a minute or two.** Wallets aren't affected, because the Snap and
  the library read PulseChain directly. Only Ethereum contracts reading the copy see the gap.

This design rules out the problems two independent registries would have: a buyer finishing only
one side, someone grabbing the second side first, renewals expiring separately, and sales that
don't carry across.

## Keys

| Key | What it does | How to hold it | If it leaked |
|---|---|---|---|
| Signing key | Signs updates for the Ethereum copy | Offline, or a multisig | Someone could write false updates to the Ethereum copy |
| Relayer gas wallet | Pays gas on both chains | Online, holding only what it needs | Someone could spend its gas money, but couldn't forge updates |
| Fee address | Receives payments | A multisig | Fees could be stolen |
| Registry admin roles | Set up the `.hex` ending and prices | Given up once setup is done | Nothing, once given up |

## Safety rules

- **Reset a name's addresses when it's sold,** so payments don't keep going to the seller.
- **One address per chain.** Ordinary wallets have the same address on PulseChain and Ethereum, but
  smart-contract wallets often don't. Only give out an address for a chain where the owner has set
  one.
- **Reserved names.** Hold back real people's names and well-known projects for verified claims.
- **Commit, then register,** everywhere. The Ethereum checkout keeps names sealed until the
  PulseChain claim is in place.
- **Automatic refunds** for Ethereum purchases that aren't completed in time.

## PulseChain constraints

- **No opcodes from Ethereum's March 2024 upgrade** (`TSTORE`, `MCOPY`; checked against the live
  chain on 2026-11-05). Everything is compiled for Shanghai. ENSv2 used `mcopy` in two of the
  files we deploy; both now use a plain copy routine that gives the same result. See
  [contracts/src/ensv2/README.md](../contracts/src/ensv2/README.md).
- **No Chainlink.** Prices are fixed in stablecoins (DAI and USDC bridged from Ethereum), and other
  tokens are swapped at checkout.

## `hex.eth`: optional, later

With `hex.eth`, `alice.hex.eth` would work in most wallets and apps that accept ENS names, without
them adding support for `.hex`. It isn't needed, and it isn't available.

- **Who owns it:** the same address since at least 2023, using it as its own ENS name. It's paid up
  until 18 March 2028.
- **If it's ever acquired:** point it at a resolver that reads the Ethereum copy (no extra server
  needed), hold it in a multisig, pay many years ahead, and lock the resolver so nobody can redirect
  it later.
- **Without it:** someone else controls what `alice.hex.eth` means. The risk is people adding
  `.eth` out of habit, or being fooled by a look-alike name, which is why the "never ends in `.eth`"
  rule matters.
- **PulseChain's copy of ENS is separate.** `hex.eth` lapsed there in 2024 and anyone can claim it.
  Don't rely on `.eth` names on PulseChain.

## Build order

1. PulseChain registry. Done: built and tested; next is handing its setup roles to a multisig.
2. Ethereum copy and relayer.
3. MetaMask Snap and JavaScript library.
4. Ethereum checkout.
5. Website.
6. Independent review, full test runs on PulseChain's and Ethereum's testnets, then mainnet.
7. Wallet outreach: see [WALLET_CHECKLIST.md](WALLET_CHECKLIST.md).

## Decisions still open

- Where the relayer runs (it must be online all the time).
- The fee address (ideally a multisig).
- Prices for 1–4 letter names.
- The reserved names list.
- The refund time limit for Ethereum purchases.
- Who reviews the code before launch.
