# contracts

Solidity contracts for hex-names, built and tested with [Foundry](https://getfoundry.sh).

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

- **The PulseChain registry:** ENSv2 ([ensdomains/contracts-v2](https://github.com/ensdomains/contracts-v2),
  MIT), ported to PulseChain for the `.hex` ending.
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
tab, workflow **test**). There are two sets:

- **Unit tests** (`test/AnyTokenCheckout.t.sol`), with stand-in tokens, router and registrar.
- **Fork tests** (`test/fork/`), against a live copy of PulseChain, with the real PulseX routers and
  real PLS, HEX, PLSX and pDAI. Only the registrar is a stand-in.

If you do have Foundry, from this folder:

```bash
./install-deps.sh
```

```bash
forge test
```

## Deploying without installing anything

The **deploy** workflow deploys from GitHub's servers. You start it from the GitHub website, which
works from a phone too. Deploy the checkout only once the `.hex` registrar exists, because it needs
the registrar's address.

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
