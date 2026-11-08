# The bot, on Railway

The bot is a small program that keeps the Ethereum side of .hex running:

- It carries PulseChain's updates across the bridge, so Ethereum's copy of every name stays current.
- It pays its own gas, out of your sales, within a budget you set ([money](#money)).

Names are bought on PulseChain, so the bot never handles a sale. If it stops, PulseChain carries on
as normal and Ethereum's copy falls behind until it's back. A restart is harmless: it picks up where
it left off.

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
  | On PulseChain, for gas | 10 tPLS ([faucet](https://faucet.v4.testnet.pulsechain.com)) | 200,000 PLS, about $1 |
  | On Ethereum, for gas (claiming bridge messages) | 0.01 Sepolia ETH | 0.01 ETH, about $22 |

  That's the only time you fund it. After that it pays its own way ([money](#money)). It needs no
  USDC from you: it draws a small working balance from your payments wallet's budget.

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
  buying from Ethereum is off (FILL=false): names are bought on PulseChain
  order encryption public key, for the website (bot.publicKey in web/src/deployment.ts): 0x… (made from the bot's wallet key)
  fill orders: false, claim bridge messages: true, copy name changes: true, pay its own gas: true
  remembers its place in /data/state.json
```

- **The first `0x…`** is the bot's wallet. Check it's the one you funded. It goes in the website's
  settings too, as `bot.address`, so the payments page can show its balances.
- **Copy the public key**, the long `0x…` after "for the website", into the website's settings
  ([the website guide](../website/README.md) says where). Buying from Ethereum is off, so nothing
  uses it now, but it's ready if that's ever switched on.
- **"WARNING: no volume is attached"** means the volume is missing: see 2.3.
- **"… is not set"** means a setting is missing: check the Variables.
- **Lines ending "(will retry)"** are passing hiccups, such as a slow RPC. It tries again by itself.
- **"daily: working balance … PLS … ETH …"**, once a day: its balances, and its budget from your
  payments wallet.
- **"gas: bought …"** and **"balance: …"** are it paying its own way ([money](#money)).
- **"bridge: holding back a claim, …"**, at most once an hour, says why a claim is waiting: a name
  copied less than an hour ago, the day's limit reached ([money](#money)), or ETH kept back to claim
  its own USDC. It goes through by itself later.
- **"WARNING: the bot is …"**, at most once a day, means it needs you: it says what for.

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
3. Check the logs, and copy its wallet and public key into the `mainnet` part of
   `web/src/deployment.ts` ([the website guide](../website/README.md)).
4. **Give it a budget.** Once the website has the bot's wallet, open the app's payments page,
   `app.hexns.domains/referrals`, with your payments wallet (`0x1027…02C6`). Under **The bot**, set
   a budget, say 100 USDC, and approve it in your wallet. That's what it may draw from your
   payments wallet if gas ever leaves it short. Do the same on the testnet site in the rehearsal.

After the rehearsal you can delete the `testnet` environment (project **Settings**, then
**Environments**) to stop paying for it, or keep it for trying changes.

## Money

The bot runs on autopilot: you fund it once with a little gas, and it pays its own way from then on.

**Every sale goes straight to your payments wallet.** Names are bought on PulseChain, and the
registrar pays each price to your payments wallet. That was fixed in step 1. The bot never touches
a sale.

**Gas comes out of revenue.** The bot keeps a small working balance of USDC on PulseChain, $20
(`FLOAT_USDC`). When its gas runs low it buys more with it: PLS on PulseX ($2 at a time, over
300,000 PLS) and ETH on Uniswap ($15 at a time, sent to Ethereum over the bridge first, which
charges 0.3% in that direction). When the working balance runs low, it draws what it needs from your
payments wallet, up to the budget you set on the app's payments page. If the working balance can't
cover a purchase of gas, it draws the difference first. If it ever holds more than it needs, the
extra comes back to your payments wallet.

**It never sends money twice.** It notes each transfer over the bridge before waiting for it, and
knows its own transfers when it sees them on the bridge, so a failed wait or a restart never sends
the same money again. On Ethereum it claims its own USDC first, and keeps enough ETH back to do so.

**What you'll see in your payments wallet:** the price of every name sold, and now and then a small
draw by the bot for gas. The app's payments page shows the bot's balances and the budget left.

**How often you need to do anything:** normally never. When you pay referrers each month, glance at
the bot on the same page. If its budget is running low, raise it. If the bot can't fix something
itself, its log says so, once a day, starting "WARNING".

**Costs.** Railway's Hobby plan, $5 a month. Gas, at 8 November 2026's prices: about 3 cents to copy
each name, renewal or transfer to Ethereum. A $100 budget covers about 3,000 of those.

**Limits on copying names.** So that nobody can run up its Ethereum gas by changing a name over and
over, it copies each name at most once an hour (the newest change wins), and spends at most 0.02 ETH
a day copying names, about 1,600 copies at November 2026's gas prices. The rest wait until the next
day (UTC). The settings `RELAY_NAME_COOLDOWN_MINUTES` (60) and `RELAY_DAILY_ETH` (0.02) change
these.

## Keeping it safe

- The bot's wallet only ever holds a little gas and its $20 working balance. The deployer's and
  admin's keys never go on Railway.
- A stolen bot key could take those, and draw up to the budget left in your payments wallet: that's
  why the budget has a limit. If you ever think the key has leaked, press **Stop it
  drawing** on the payments page, then give the bot a new wallet.
- Seal the key (2.5). Turn on two-factor sign-in for Railway and GitHub (your phone gives a code
  each time you sign in).
- Anyone who can open the Railway project can change the bot's settings. Keep it to yourself.

## Changing it later

- **New code:** when a change to `bot/` reaches `main`, Railway updates the bot by itself. The bot
  saves its place, stops, and the new version carries on from there.
- **New settings:** edit them under **Variables**, then **Details** and **Deploy** in the bar at the
  top, as in 2.6.

The optional settings (other RPCs, the limits on copying names, and those only used if buying from
Ethereum is switched on, such as the bot's fee) are listed in
[`bot/.env.example`](../../bot/.env.example). On/off settings (`FILL`, `RELAY`, `SYNC`, `TREASURY`)
take true/false, 1/0, yes/no or on/off; anything else stops the bot, and its log says which setting.
To run the bot on a computer instead, see [`bot/README.md`](../../bot/README.md).
