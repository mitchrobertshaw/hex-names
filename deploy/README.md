# Deploying .hex

You do all of this in a web browser. There's nothing to download or install, and no command prompt.
Do it twice:

1. **On the testnets** (practice copies of PulseChain and Ethereum, with free coins that are worth
   nothing): a full rehearsal.
2. **On mainnet** (the real chains, with real money): the same again, for real.

The rehearsal takes about two hours, much of it waiting for the bridge.

## Who does what

Three websites do the heavy lifting. You make wallets, press buttons and copy addresses from one to
the next.

| | What it does by itself | What you do | The folder it uses |
|---|---|---|---|
| **GitHub** (GitHub Actions: GitHub's computers, which run jobs for you) | Tests the contracts, puts them on the chains, and prints their addresses | Store the deployer's key, press **Run workflow** for each of the three steps, and copy what each one prints | `src/` and `script/` |
| **Railway** (a hosting company) | Runs the bot day and night. It restarts the bot if it stops, and updates it when the code changes | Set it up once, then paste in the bot's settings | `bot/` |
| **Netlify** (another hosting company) | Builds and serves the website and the app. It rebuilds them whenever `main` changes | Connect it once, then fill in one file of addresses | `web/` |

**What gets deployed** (put on a blockchain) are the contracts (smart contracts: programs that live on
a blockchain, whose code nobody can change afterwards). GitHub deploys them. You never handle them
yourself.

## The folders

You don't download any of these. GitHub, Railway and Netlify each take what they need from the repo
(the project's folder on GitHub, with every version of every file).

| Folder | What's in it | Used by |
|---|---|---|
| `src/` | the contracts | GitHub, when you deploy |
| `script/` | the three deploy steps, and [`reserved-names.csv`](../script/reserved-names.csv) (the names set aside at launch) | GitHub, when you deploy |
| `test/` | tests for the contracts | GitHub, before every deploy and every change |
| `bot/` | the bot | Railway |
| `web/` | the website and the app | Netlify |
| `.github/workflows/` | `deploy.yml`, the **Run workflow** button for deploying, and `test.yml`, the checks on every change | GitHub |
| `deploy/` | these guides | you |

**The only files you edit**, both on GitHub's website:

- [`script/reserved-names.csv`](../script/reserved-names.csv), before you deploy, if you want to
  reserve more names.
- [`web/src/deployment.ts`](../web/src/deployment.ts), after you deploy, so the website knows where
  .hex is.

To edit a file: open it on GitHub, click the pencil icon, make the change, then **Commit changes**
(save it into `main`, the version that counts).

## What you'll need

**Accounts:** GitHub (you have it), [Railway](https://railway.com) on its Hobby plan ($5 a month,
including $5 of use, enough for the bot), and [Netlify](https://www.netlify.com) (free). Sign in to
both with GitHub.

**Wallets.** Make them in MetaMask or Rabby, on a computer or phone of your own, not a work laptop.
In MetaMask, add an account, then copy its private key from the account's details.

An **address** (starts with `0x`) is like an account number: safe to share. A **private key** is the
secret that controls a wallet. Anyone who has it can take everything in it, so paste it only where
this guide says. Never paste a seed phrase (the 12 or 24 backup words) anywhere.

| Wallet | For the testnets | For mainnet | Its private key goes in |
|---|---|---|---|
| **Deployer**: pays for deploying, and has no powers once step 3 is done | a new one | another new one | GitHub, as a repository secret |
| **Admin**: can change prices and payment tokens, and hand held names to their owners. It can't take anyone's name | any wallet of yours | a hardware wallet (Ledger, Trezor) or a Safe | nowhere: you only type its address |
| **Bot**: the bot's own wallet, with its float | a new one | another new one | Railway, as a sealed variable |

**Coins** (gas is the fee a chain charges for each transaction, paid in its own coin):

| | Testnets | Mainnet |
|---|---|---|
| Deployer, on PulseChain (steps 1 and 3) | 10 tPLS, free from the [faucet](https://faucet.v4.testnet.pulsechain.com) (a site that gives out test coins) | 50,000 PLS. Step 1 would have cost about 15,000 at 7 November 2026's gas prices; the rest is in case gas rises |
| Deployer, on Ethereum (step 2) | 0.01 Sepolia ETH, free ([faucets](ethereum/README.md#sepolia-eth)) | 0.02 ETH |
| Bot, on PulseChain | 10 tPLS for gas, and 20 to 50 test USDC as its float | 50,000 PLS, and $100 to $500 of USDC as its float |
| Bot, on Ethereum | 0.01 Sepolia ETH | 0.01 ETH |

The bot's **float** is money it pays for names ordered from Ethereum. Each order pays it back on
Ethereum about 15 minutes later. Send what's left in the deployer wallet back to yourself afterwards.

## Part 1: rehearse on the testnets

1. **Make and fund the testnet wallets**: a deployer and a bot, as above. Add the testnets to your
   wallet: [PulseChain Testnet v4](https://chainlist.org/chain/943) and
   [Sepolia](https://chainlist.org/chain/11155111).

2. **Get test USDC onto PulseChain Testnet v4** (USDC is a dollar stablecoin: names are priced in
   it). It comes from Sepolia over the testnet bridge (the bridge moves coins and messages between
   the two chains), and step 1 won't start until someone has done this once. Bridge about 50 to your
   own wallet, then send 20 of it to the bot.
   [How](pulsechain/README.md#testnets-usdc-from-sepolia), about 20 minutes.

3. **Check the reserved names** in [`script/reserved-names.csv`](../script/reserved-names.csv).
   Step 1 sets them aside.

4. **Give GitHub the deployer's key.** In the repo, go to **Settings**, then **Secrets and variables**,
   then **Actions**, then **New repository secret**. Set the name to `DEPLOYER_PRIVATE_KEY_TESTNET`
   and the secret to the testnet deployer's private key. A repository secret is a value GitHub keeps
   encrypted and only gives to the workflow (the deploy job). Nobody can see it again, not even you.

5. **Run the three steps.** For each one, go to **Actions**, then **deploy**, then **Run workflow**,
   and fill in the form. Run it once with **Send it for real** unticked: that's a dry run, which
   checks everything and sends nothing. If it ends well, run it again ticked. When a run finishes, open
   it and scroll down to its summary, which lists what it made.

   | Step | Where | What you copy from its summary |
   |---|---|---|
   | 1. Deploy on PulseChain | [PulseChain guide](pulsechain/README.md#step-1-deploy-on-pulsechain) | two addresses for step 2, and the **For the bot** lines |
   | 2. Deploy on Ethereum and link it | [Ethereum guide](ethereum/README.md#step-2-deploy-on-ethereum-and-link-it) | two addresses for step 3, and the **For the bot** lines |
   | 3. Link PulseChain | [PulseChain guide](pulsechain/README.md#step-3-link-pulsechain) | nothing: it ends "Linked. .hex is live" |

   Each step takes 5 to 10 minutes. Keep the summaries: the bot and the website need them.

6. **Start the bot on Railway**, in a `testnet` environment (a separate copy of the bot, with its own
   settings). [The bot guide](bot/README.md), about 15 minutes. Copy the public key it prints.

7. **Put up a testnet copy of the website.** Fill in the `testnet` part of `web/src/deployment.ts`,
   then add a second Netlify project that shows the testnets. [The website guide](website/README.md).

8. **Try everything** on the testnet copy's app (its address ends in `/app`):

   - [ ] Buy a name on PulseChain Testnet v4 with USDC. It's yours in about two minutes, and on
         Sepolia about 15 minutes later.
   - [ ] Order a name from Sepolia, paying in USDC or Sepolia ETH. The bot registers it on
         PulseChain within about a minute and a half. It's paid back on Sepolia about 15 minutes
         later.
   - [ ] Order a name someone already has. The bot refunds it over the bridge.
   - [ ] Look names up on both chains. Then send one to another wallet on PulseChain, and watch
         Sepolia follow.
   - [ ] Order a name from Sepolia, and restart the bot straight away (on Railway, the ⋮ menu of
         its latest deployment, then **Restart**). It picks up where it left off and still fills the
         order. Each order has 30 minutes. If the bot is down for longer, it refunds the order when
         it's back.

## Part 2: mainnet

When everything above has worked, and someone other than the author has reviewed the contracts:

1. **New wallets**: a new deployer and a new bot, funded with real coins as above. The admin should
   be a hardware wallet or a Safe, and the same address for steps 1 and 2.
2. **Check the reserved names** again.
3. **Add the repository secret** `DEPLOYER_PRIVATE_KEY_MAINNET` with the mainnet deployer's private
   key, the same way as in Part 1.
4. **Run the three steps** with **Mainnet: PulseChain + Ethereum**. To send for real on mainnet, also
   type `mainnet` in the **confirm** box. This guards against a slip of the mouse.
5. **Start the bot** in Railway's `production` environment, with the mainnet settings
   ([the bot guide](bot/README.md#mainnet)).
6. **Fill in `mainnet`** in `web/src/deployment.ts`. That switches on buying in the app and the
   live numbers on the homepage. Then add the domains and launch
   ([the website guide](website/README.md#mainnet-launch)).

Before step 2 on Ethereum, check the note on
[Ethereum's next upgrade](ethereum/README.md#ethereums-next-upgrade).

Not automated yet: verifying the contracts (publishing their source code on the block explorers
scan.pulsechain.com and etherscan.io, so anyone can check them).

## If a step stops

Fix what it says, then run the same step again. Steps 1 and 2 start afresh each time. Whatever a
stopped run deployed is simply never used.

| It says | What to do |
|---|---|
| USDC isn't on PulseChain Testnet v4 yet | Bridge some USDC from Sepolia first (Part 1, step 2). |
| Add the DEPLOYER_PRIVATE_KEY_TESTNET (or _MAINNET) repository secret | Add the key (Part 1, step 4). |
| type mainnet in the confirm box | It's a real mainnet run: type `mainnet` in the confirm box. |
| ADMIN is a contract that cannot hold ERC-1155 tokens | The admin is a "smart account" or another contract. Use a plain wallet, a hardware wallet or a Safe. |
| The wallet for name.hex is a contract that cannot hold ERC-1155 tokens | That reserved name's wallet can't hold the name. Leave its wallet empty, so the name is held instead. |
| step 1 used a different deployer key | Run every step of a network with the same deployer key. |
| step 1 was deployed for a different Ethereum network | Choose the same network for all three steps. |
| the two addresses are from different deployments | Copy both addresses from the same step 1 summary. |
| already linked | That step is already done. If step 3 stopped halfway, one of its two links went through: ask for help linking the other. |
| Insufficient funds | Top up the deployer wallet. |

## Words you'll meet

| Word | What it means |
|---|---|
| Testnet / mainnet | A practice copy of a blockchain with worthless coins / the real blockchain |
| PulseChain Testnet v4, Sepolia | The testnets of PulseChain and Ethereum |
| tPLS, Sepolia ETH | The testnets' free coins |
| Faucet | A website that gives out free testnet coins |
| Gas | The fee for a transaction, paid in the chain's coin (PLS or ETH) |
| Contract (smart contract) | A program on a blockchain. Nobody can change its code once it's deployed |
| Deploy | Put contracts on a blockchain |
| Bridge | Moves coins and messages between PulseChain and Ethereum, in about 15 to 20 minutes |
| USDC | A dollar stablecoin: 1 USDC is worth about $1 |
| Float | The bot's working money for names ordered from Ethereum |
| Address | A wallet's or contract's public number, starting `0x`. Safe to share |
| Private key | The secret that controls a wallet. Never share it |
| Hardware wallet | A small device (Ledger, Trezor) that keeps a wallet's key off your computer |
| Safe | A wallet that needs approval from more than one key (safe.global) |
| Admin / deployer | The wallet that can change prices / the wallet that pays for the deploy |
| Block, start block | The chain's numbered batches of transactions; where the bot starts reading |
| RPC | The web address programs use to talk to a chain, for example `https://rpc.pulsechain.com` |
| Explorer | A website for looking up transactions and contracts: scan.pulsechain.com, etherscan.io |
| Repo (repository) | The project's folder on GitHub |
| `main` | The version of the repo that counts: deploys, the bot and the website all use it |
| Commit | A saved change to the repo |
| Pull request | A set of changes waiting to be added to `main` |
| GitHub Actions, workflow | GitHub's computers, and a job they run (`deploy` is the one with the button) |
| Dry run / Send it for real | A step that checks and sends nothing / one that sends the transactions |
| Run summary | The report at the bottom of a finished run's page |
| Repository secret | A value GitHub keeps hidden and gives only to workflows |
| Railway project, environment, service | Everything for the bot; a separate copy of it (testnet, production); the bot itself |
| Variable, sealed variable | A setting the bot reads when it starts; one Railway hides for good |
| Volume | A small disk that keeps the bot's notes when it restarts |
| Redeploy | Railway rebuilding and restarting the bot, after a change to `main` or its settings |
| Logs | What the bot writes as it works |
| Netlify project | One copy of the website on Netlify: the real one, and a testnet one |
| ENSv2 | The new version of the Ethereum Name Service, which .hex is built on |
