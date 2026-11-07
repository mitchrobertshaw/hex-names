# The bot, on Railway

The bot is a small program that keeps the Ethereum side of .hex running:

- When someone pays on Ethereum, it buys the name on PulseChain for them, within about a minute and
  a half.
- It carries PulseChain's updates across the bridge, so Ethereum's copy of every name stays current.

If it stops, PulseChain carries on as normal, but Ethereum's copy falls behind and orders from
Ethereum wait. An order has 30 minutes to be filled. If the bot is down for longer than that, it
refunds the order when it's back. A restart is harmless: it picks up where it left off.

[Railway](https://railway.com) runs it for you. It builds the bot from the `bot/` folder of `main`,
starts it again if it ever stops, and updates it when `bot/` changes. Railway calls each separate
copy an **environment**. You'll have two, each with its own wallet, settings, disk and logs:

| Railway environment | Network | When |
|---|---|---|
| `testnet` | PulseChain Testnet v4 and Sepolia | the rehearsal |
| `production` | PulseChain and Ethereum | mainnet, for real |

New to this? [Start here](../README.md).

## Before you start

- **Steps 1 to 3 done** on that network. You'll need the **For the bot** block from the summaries of
  steps 1 and 2.
- **The bot's own wallet**, new, and funded. It has the same address on both chains.

  | | Testnet | Mainnet |
  |---|---|---|
  | On PulseChain, for gas | 10 tPLS ([faucet](https://faucet.v4.testnet.pulsechain.com)) | 50,000 PLS |
  | On PulseChain, its float (to pay for names ordered from Ethereum) | 20 to 50 test USDC ([how](../pulsechain/README.md#testnets-usdc-from-sepolia)) | $100 to $500 of USDC, bridged from Ethereum |
  | On Ethereum, to claim bridge messages | 0.01 Sepolia ETH | 0.01 ETH |

## 1. Set up Railway (once)

1. **Sign in** at [railway.com](https://railway.com) with GitHub, and choose the **Hobby** plan:
   $5 a month, which includes $5 of use, and the bot uses less. The free trial won't do: it can't
   keep restarting the bot for good.
2. **New Project**, then **Empty Project**. In the project's **Settings**, name it `hexns-bot`.
3. **Make the testnet environment.** At the top of the page there's an environment menu (it says
   `production`). Choose **+ New Environment**, then **Empty Environment**, and name it `testnet`.

## 2. Add the bot

Check that the environment menu at the top says `testnet` (or `production`, for mainnet).

1. **Add it from GitHub:** click **New** (top right), then **GitHub Repo**, then `hex-names`. If
   it isn't listed, choose **Configure GitHub App** and give Railway access to `hex-names`. The bot
   appears on the canvas (the project's board). Its first build fails, because it has no settings
   yet. That's expected.

2. **Point it at the bot's folder.** Click the bot, then **Settings**:

   | Setting | Set it to | Why |
   |---|---|---|
   | Root Directory | `/bot` | Railway builds only the bot's folder |
   | Watch Paths | `/bot/**` | it updates the bot only when the bot changes, not the website |
   | Restart Policy | Always | it starts the bot again if it ever stops |

3. **Give it a volume** (a small disk that keeps its files when the bot restarts). Right-click an
   empty part of the canvas and choose **Volume**. Or press Ctrl+K (⌘K on a Mac) and type "volume".
   Pick the bot, and set the **mount path** (where the disk appears to the bot) to `/data`. The bot
   keeps its notes there. Without one, every restart makes it re-read every block since the deploy.

4. **Enter its settings** (variables: settings the bot reads when it starts). Open **Variables**,
   then **RAW Editor**, and paste these three lines, with the bot wallet's private key:

   ```
   NETWORK=testnet
   RAILPACK_NODE_VERSION=24
   BOT_PRIVATE_KEY=0x...
   ```

   Under them, paste the **For the bot** lines from step 1's summary, then step 2's. Save.

   | Line | What it is |
   |---|---|
   | `NETWORK` | `testnet`, or `mainnet` in the `production` environment |
   | `RAILPACK_NODE_VERSION` | the version of Node.js (what the bot runs on) for Railway to use |
   | `BOT_PRIVATE_KEY` | the bot wallet's private key |
   | `PULSECHAIN_...`, `ETHEREUM_...`, `START_BLOCK_...` | where .hex's contracts are, and the block each was deployed in, from the run summaries |

5. **Seal the private key.** On the `BOT_PRIVATE_KEY` row, open the ⋮ menu and choose **Seal**.
   Railway still gives it to the bot, but never shows it again to anyone, you included. You can
   replace it later, but not read it.

6. **Apply it.** Railway holds changes back until you apply them, and shows how many are waiting in
   a bar at the top. Click **Details**, then **Deploy**.

## 3. Check it's running

Click the bot, then its latest deployment, then **Deploy Logs** (what the bot writes as it works).
Within a minute you should see:

```
hex-names bot 0x… on the testnets (PulseChain Testnet v4 + Sepolia)
  pays out to 0x… on Ethereum
  order encryption public key, for the website (bot.publicKey in web/src/deployment.ts): 0x… (made from the bot's wallet key)
  fill orders: true, claim bridge messages: true, copy name changes: true
  remembers its place in /data/state.json
```

- **The first `0x…`** is the bot's wallet. Check it's the one you funded.
- **Copy the public key**, the long `0x…` after "for the website". The website seals each order with
  it (locks the order's details, so only the bot can read which name is being bought).
  [The website guide](../website/README.md) says where it goes.
- **"WARNING: no volume is attached"** means the volume is missing: see 2.3.
- **"… is not set"** means a setting is missing: check the Variables.
- **Lines ending "(will retry)"** are passing hiccups, such as a slow RPC. It tries again by itself.

On its first run the bot also copies the reserved names that went straight to a wallet over to
Ethereum. You'll see "yourfriendsommi.hex changed on PulseChain; copy sent to Ethereum". About 15
minutes later comes "bridge message … from HexMirrorSync claimed on Ethereum".

## Mainnet

After steps 1 to 3 on mainnet:

1. Switch the environment menu at the top to `production`.
2. Do [section 2](#2-add-the-bot) again there, with:
   - `NETWORK=mainnet`;
   - the **mainnet** bot wallet's private key: a different wallet from the testnet one, funded with
     real coins;
   - the **For the bot** lines from the mainnet runs.
3. Check the logs, and copy its public key into the `mainnet` part of `web/src/deployment.ts`.

After the rehearsal you can delete the `testnet` environment (project **Settings**, then
**Environments**) to stop paying for it, or keep it for trying changes.

## Money

- **The float.** The bot pays USDC on PulseChain for each name ordered from Ethereum. Each order
  pays it back in USDC on Ethereum about 15 minutes later. Now and then, move that USDC back to
  PulseChain through the official bridge or LibertySwap, and top up the bot's PLS and ETH for gas.
- **Paid elsewhere** (optional): add `PAYEE=0x…` to have orders pay a wallet of yours instead. Then
  you top up the bot's USDC on PulseChain yourself.
- **Costs.** Railway's Hobby plan, $5 a month. Gas: a few cents for each order and bridge claim.

## Keeping it safe

- The bot's wallet only ever holds its float. The deployer's and admin's keys never go on Railway.
- Seal the key (2.5). Turn on two-factor sign-in for Railway and GitHub (your phone gives a code
  each time you sign in).
- Anyone who can open the Railway project can change the bot's settings. Keep it to yourself.

## Changing it later

- **New code:** when a change to `bot/` reaches `main`, Railway updates the bot by itself. The bot
  saves its place, stops, and the new version carries on from there.
- **New settings:** edit them under **Variables**, then **Details** and **Deploy** in the bar at the
  top, as in 2.6.

The optional settings (other RPCs, the bot's fee and so on) are listed in
[`bot/.env.example`](../../bot/.env.example). To run the bot on a computer instead, see
[`bot/README.md`](../../bot/README.md).
