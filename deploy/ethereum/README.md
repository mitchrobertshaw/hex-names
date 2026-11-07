# Ethereum: step 2

**Yes, .hex is deployed on Ethereum too.** Names live on PulseChain, and step 2 puts the other half
on Ethereum. [Start here](../README.md) if you haven't.

| What step 2 deploys | What it does |
|---|---|
| ENSv2's registries and resolvers, and `UniversalResolverV2` | the Ethereum copy of `.hex`, so Ethereum apps and wallets can look `.hex` names up |
| [`HexMirrorRegistrar`](../../src/ethereum/HexMirrorRegistrar.sol) | the only thing that writes the copy, from bridge messages sent by `HexMirrorSync` on PulseChain |
| [`HexOrderBook`](../../src/ethereum/HexOrderBook.sol) | buying from Ethereum: it holds each buyer's payment until the bridge confirms the name was registered on PulseChain, or refunds it |

Without step 2, names would only work on PulseChain and nobody could buy one from Ethereum. Step 3
can't be done without it either.

| | Sepolia | Ethereum |
|---|---|---|
| Chain ID | 11155111 | 1 |
| Coin | Sepolia ETH, free | ETH |
| RPC used by the workflow | `https://ethereum-sepolia-rpc.publicnode.com` | `https://ethereum-rpc.publicnode.com` |
| Explorer | [sepolia.etherscan.io](https://sepolia.etherscan.io) | [etherscan.io](https://etherscan.io) |
| Its PulseChain side | PulseChain Testnet v4 | PulseChain |

## Sepolia ETH

The deployer needs 0.01 Sepolia ETH. Step 2 costs about 0.0015.

Faucets come and go. On 7 November 2026 these were up:

- [Google Cloud's faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia), with a
  Google account.
- [sepolia-faucet.pk910.de](https://sepolia-faucet.pk910.de), which has your browser do some work
  for a few minutes instead.

Sepolia already has Ethereum's next upgrade, which makes creating contracts about 7 times dearer in
gas: step 2 uses about 146 million gas there. Gas on Sepolia is close to free, though, and the
workflow pays a 0.01 gwei tip there. Left to itself, Foundry would tip about 1 gwei and step 2 would
cost about 0.15 Sepolia ETH.

## Step 2: deploy on Ethereum and link it

After [step 1](../pulsechain/README.md#step-1-deploy-on-pulsechain). On GitHub: Actions,
**deploy**, Run workflow.

| Field | Fill in |
|---|---|
| Network | the same as step 1 |
| Step | 2. Deploy on Ethereum and link it |
| Send it for real | unticked for the dry run, then ticked |
| Admin wallet | the same admin as step 1. On Ethereum it only owns the list of lookup gateways and the contract namer, and has no say over names |
| `PULSECHAIN_MIRROR_SYNC`, `PULSECHAIN_ORDER_FILLER` | from step 1's summary |

Before sending anything, it checks on PulseChain that those two addresses are .hex contracts from
the same step 1, deployed with the same key for the same network, and not linked yet. Then it
deploys about 19 transactions' worth of contracts and links the new `HexMirrorRegistrar` and
`HexOrderBook` to them, for good. That takes 5 to 10 minutes.

The summary lists:

| Line | Needed by |
|---|---|
| `ETHEREUM_MIRROR_REGISTRAR`, `ETHEREUM_ORDER_BOOK` | step 3, and the bot |
| `START_BLOCK_ETHEREUM` | the bot: where it starts reading |
| `UniversalResolver` | the website and wallets: looking names up on Ethereum |
| `.hex registry (copy)`, Root registry, Default resolver and the rest | for reference |

Then do [step 3 on PulseChain](../pulsechain/README.md#step-3-link-pulsechain).

## Mainnet

- **Budget about 0.02 ETH.** Step 2 cost about 0.0023 ETH on 5 November 2026.
- **Avoid a "smart account" as the admin.** Some wallets, MetaMask among them, offer to upgrade an
  account into one (an EIP-7702 delegation). Many of these can't hold the `hex` token, and steps 1
  and 2 refuse an admin that can't. Use a plain wallet or a Safe.
- **Ethereum's next upgrade.** The workflow uses Foundry 1.9.0, which knows that Sepolia has it.
  When Ethereum gets the upgrade too, creating contracts there will cost about 7 times the gas.
  Update the Foundry `version` in `.github/workflows/deploy.yml` to a release from after the
  upgrade before running step 2, or it will run out of gas. Until then, 1.9.0 is right.
- Afterwards, verify the contracts on [etherscan.io](https://etherscan.io).
