# PulseChain: steps 1 and 3

Names live on PulseChain. Step 1 deploys everything here. Step 3, after step 2 on Ethereum, links it
to Ethereum. [Start here](../README.md) if you haven't.

| | PulseChain Testnet v4 | PulseChain |
|---|---|---|
| Chain ID | 943 | 369 |
| Coin | tPLS, free | PLS |
| RPC | `https://rpc.v4.testnet.pulsechain.com` | `https://rpc.pulsechain.com` |
| Explorer | [scan.v4.testnet.pulsechain.com](https://scan.v4.testnet.pulsechain.com) | [scan.pulsechain.com](https://scan.pulsechain.com) |
| Faucet | [faucet.v4.testnet.pulsechain.com](https://faucet.v4.testnet.pulsechain.com), 10 tPLS a request | |
| Its Ethereum side | Sepolia | Ethereum |

To add the testnet to your wallet, use [chainlist.org/chain/943](https://chainlist.org/chain/943) or
enter the details above.

## The deployer's PLS

- **Testnet:** 10 tPLS, one request at the faucet. Steps 1 and 3 cost about 0.03 tPLS. The workflow
  sets a 1 gwei tip, which the testnet's validators accept: the network itself suggests about 3,385
  gwei, which would make step 1 cost about 92 tPLS.
- **Mainnet:** about 50,000 PLS. Step 1 uses about 27 million gas, which cost about 28,500 PLS on
  5 November 2026 and about 14,000 PLS on 7 November. Step 3 costs under 100 PLS.

## Testnets: USDC from Sepolia

Names are paid for in USDC. On mainnet that's USDC bridged from Ethereum. On the testnet it's
Circle's test USDC bridged from Sepolia, which the testnet bridge calls "USDC from Sepolia". Its copy
on the testnet appears the first time someone bridges the token. On 7 November 2026 nobody had, so
step 1 stops until someone does. DAI from Sepolia, the other accepted coin, is already there.

1. **Get Sepolia ETH** for gas ([faucets](../ethereum/README.md#sepolia-eth)).
2. **Get test USDC on Sepolia** at [faucet.circle.com](https://faucet.circle.com): choose Ethereum
   Sepolia and paste your address. Circle's test USDC is
   `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`. You can also swap a little Sepolia ETH for it on
   Uniswap, with testnets turned on in its settings.
3. **Bridge it** at [bridge.v4.testnet.pulsechain.com](https://bridge.v4.testnet.pulsechain.com):
   from Sepolia to PulseChain Testnet v4, token USDC, to your own wallet. Check the token address is
   the one above, and paste it in if USDC isn't listed. Send 50 or so: a name costs 10, and the bot
   needs a float to fill orders from Sepolia.
4. **Wait about 15 to 20 minutes.** That's how long the testnet bridge took on 7 November 2026, much
   like the real one.

To check it worked, run step 1 as a dry run: if it gets past the USDC check, you're ready. Its
summary shows the testnet's USDC as `PULSECHAIN_USDC`. Add that address to your wallet to see your
balance, and give it to the bot.

On the testnet, pay for names in USDC. Paying in tPLS goes through PulseX, and PulseX's testnet has
no pool for USDC from Sepolia.

## Step 1: deploy on PulseChain

On GitHub: Actions, **deploy**, Run workflow.

| Field | Fill in |
|---|---|
| Network | Testnet or Mainnet |
| Step | 1. Deploy on PulseChain |
| Send it for real | unticked for the dry run, then ticked |
| Admin wallet | the admin ([choosing one](../README.md#1-get-ready)) |
| Who receives payments | optional: the wallet every payment goes to. The admin if left empty |

Before sending anything, it checks:

- that the admin, and the wallet of every given reserved name, can hold the name token;
- that the bridge, USDC, DAI, WPLS and both PulseX routers are where they should be.

Then it deploys about 30 transactions' worth of contracts and sets aside the reserved names. That
takes 5 to 10 minutes.

The summary lists:

| Line | Needed by |
|---|---|
| `PULSECHAIN_MIRROR_SYNC`, `PULSECHAIN_ORDER_FILLER` | steps 2 and 3, and the bot |
| `PULSECHAIN_REGISTRAR`, `PULSECHAIN_HEX_REGISTRY` | the bot and the website |
| `PULSECHAIN_USDC` | the bot, on the testnet |
| `START_BLOCK_PULSECHAIN` | the bot: where it starts reading |
| `AnyTokenCheckout` | the website: buying with any token |
| `UniversalResolver` | the website and wallets: looking names up |
| Root registry, Default resolver, Price oracle, Resolver factory and the rest | for reference |
| Reserved names given and held | a check against the list |

Then do [step 2 on Ethereum](../ethereum/README.md#step-2-deploy-on-ethereum-and-link-it).

## Step 3: link PulseChain

After step 2. On GitHub: Actions, **deploy**, Run workflow.

| Field | Fill in |
|---|---|
| Network | the same as steps 1 and 2 |
| Step | 3. Link PulseChain |
| `PULSECHAIN_MIRROR_SYNC`, `PULSECHAIN_ORDER_FILLER` | from step 1's summary |
| `ETHEREUM_MIRROR_REGISTRAR`, `ETHEREUM_ORDER_BOOK` | from step 2's summary |

It checks on Ethereum that the two Ethereum contracts are .hex's, and already linked to these two.
Then it links `HexMirrorSync` and `HexOrderFiller` to them, in two transactions. That's for good:
nobody can change it afterwards. The summary ends "Linked. .hex is live on PulseChain Testnet v4
(or PulseChain) and its Ethereum side."

Then [run the bot](../README.md#4-run-the-bot).

## Mainnet

- The admin should be a Safe.
- Afterwards, verify the contracts on [scan.pulsechain.com](https://scan.pulsechain.com): Sourcify
  covers PulseChain.
