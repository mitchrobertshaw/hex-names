# contracts

Solidity contracts for hex-names, built and tested with [Foundry](https://getfoundry.sh).

## The `.hex` registry

Built and tested, not deployed.

The registry is ENSv2, ported to PulseChain: see [src/ensv2/README.md](src/ensv2/README.md) for what
was copied and the two changes needed. `script/HexStack.sol` deploys it for the `.hex` ending,
wired the same way ENS wires `.eth`:

- a **root registry** holding `hex`, and a **`.hex` registry** holding the names;
- a **registrar** with permission to register and renew in the `.hex` registry, taking payment in
  DAI or USDC bridged from Ethereum;
- a **rent price oracle** with the prices below;
- a **universal resolver** that looks names up by walking down from the root;
- a **resolver template**: each owner gets their own copy, through the verifiable factory, to hold
  their addresses and other records.

The settings are in `script/HexConfig.sol`:

| Setting | Value |
|---|---|
| Names of 5+ characters | $5 a year |
| 4 characters | $160 a year (placeholder copied from ENS, to be decided) |
| 3 characters | $640 a year (placeholder copied from ENS, to be decided) |
| 1–2 characters | Can't be registered |
| Multi-year discounts | None |
| Shortest registration | 28 days |
| Grace period after expiry | 28 days |
| Commit, then wait | At least 60 seconds, at most 1 day |
| Recently released names | Extra premium, starting at ENS's level and halving daily, gone after 21 days |

The oracle charges per second with the rate rounded up, so a year costs $5.000001264.

`script/DeployHexRegistry.s.sol` deploys the whole stack. A dry run against live PulseChain on
2026-11-05 used about 30.7 million gas, roughly 27,400 PLS. The deploying account keeps the setup
roles, so use it for dry runs only until the step that hands them to a multisig exists.

## `AnyTokenCheckout`

Built and tested, not deployed.

It lets someone pay for a `.hex` name with any token on PulseChain at a fixed $5 a year. The buyer
pays with PLS, HEX, PLSX, pDAI or any other token with a PulseX pool. The contract swaps it into DAI
bridged from Ethereum, pays the registrar exactly its price, and sends back the change. The
registrar only ever sees stablecoins, so the price stays at $5 without a price oracle.

### How a purchase works

1. **Commit.** A sealed commitment (a hash of the name, the owner and a secret) goes to the registrar
   first. The website's relayer can send this step for the buyer.
2. **Wait** for the registrar's minimum commitment age, about a minute.
3. **Pay.** The buyer calls `registerWithToken` (after approving the token) or `registerWithPLS` with
   the same name, owner and secret. In that one transaction the contract:
   - takes the buyer's token, or wraps their PLS,
   - swaps it to DAI on PulseX V1 or V2,
   - checks the DAI covers the price, and reverts if it doesn't,
   - pays the registrar exactly the price, which registers the name,
   - sends the leftover DAI back to the buyer.

Renewals work the same way through `renewWithToken` and `renewWithPLS`, without the commit step.

### Safety properties

- **No owner and no admin.** Nothing can be changed after deployment.
- **Holds nothing.** Amounts are measured as balance changes inside each transaction, so tokens
  with transfer taxes work. Tokens sent to the contract by mistake are never paid out to anyone.
- **Only allow-listed routers,** fixed at deployment (PulseX V1 and V2).
- **Bounded loss to sandwich attacks.** The most a buyer can lose is the buffer they add to the
  quote, a few cents on a $5 name.
- **Re-entry blocked.**

### For websites

- Call `quoteRegister(label, duration, router, path)` for the price and roughly how much of the
  buyer's token covers it. An empty path quotes in DAI itself.
- Add a buffer before paying: 1–2% for price movement, plus twice the token's transfer tax if it has
  one (it's taxed on the way in and again on the way to the pool).
- Pass the price as `amountOutMin`, so the swap fails early rather than underpaying.
- Change comes back in DAI, even when the buyer paid in PLS.

## Coming next

- **Handing over the setup roles:** a deploy step that gives the registry's setup roles to a
  multisig, or gives them up, so no single key keeps them.
- **The Ethereum copy and the Ethereum checkout.** See [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## PulseChain notes

- **Compiled for Shanghai.** PulseChain lacks the opcodes from Ethereum's March 2024 upgrade
  (`TSTORE`, `MCOPY`; checked against the live chain on 2026-11-05), so `foundry.toml` sets
  `evm_version = "shanghai"`.
- **No Chainlink.** Prices are fixed in stablecoins, and other tokens are swapped at checkout.

Addresses used (PulseChain, checked 2026-11-05):

| What | Address |
|---|---|
| WPLS | `0xA1077a294dDE1B09bB078844df40758a5D0f9a27` |
| DAI bridged from Ethereum (payment token) | `0xefD766cCb38EaF1dfd701853BFCe31359239F305` |
| USDC bridged from Ethereum | `0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07` |
| PulseX V1 router | `0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02` |
| PulseX V2 router | `0x165C3410fC91EF562C50559f7d2289fEbed552d9` |

## Running the tests

Nothing needs installing on your own computer: GitHub runs the tests on every push (the **Actions**
tab, workflow **test**).

- **`test/HexRegistry.t.sol`:** the real registry stack for `.hex`. Prices, short names rejected,
  registering, looking `alice.hex` up, renewing, and paying through `AnyTokenCheckout`.
- **`test/LibMem.t.sol`:** the copy routine that replaces `mcopy`, checked against a byte-by-byte
  reference, including overlapping copies.
- **`test/AnyTokenCheckout.t.sol`:** the checkout on its own, with stand-in tokens, router and
  registrar.
- **`test/fork/`:** against a live copy of PulseChain. The whole registry, deployed with the real
  bridged DAI and USDC, paid for in PLS through the real PulseX pools and looked up; plus the
  checkout paying with real PLS, HEX, PLSX and pDAI.

If you do have Foundry, from this folder:

```bash
./install-deps.sh
```

```bash
forge test
```

## Deploying without installing anything

The **deploy** workflow deploys the checkout from GitHub's servers. You start it from the GitHub
website, which works from a phone too. Deploy the checkout only once the `.hex` registrar exists,
because it needs the registrar's address. The registry gets its own deploy option once the role
handover step is built.

1. **Create a new wallet just for deploying** and send it a little PLS for gas. Don't use your main
   wallet: the contract has no owner, so this key has no power once the deployment is done, and you
   can empty it afterwards.
2. **Add its private key as a secret.** In the repo, go to Settings > Environments > New
   environment, name it `pulsechain`, and add a secret called `DEPLOYER_PRIVATE_KEY`. On the same
   page you can require your own approval before each run.
3. **Do a dry run.** Actions > deploy > Run workflow, enter the registrar's address, and leave
   **broadcast** unticked. This simulates the deployment against the live chain and sends nothing.
4. **Deploy.** Run it again with **broadcast** ticked. The new contract's address is in the run's
   log, and the deployment record is attached to the run as an artifact.
