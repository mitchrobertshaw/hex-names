# The .hex bot

Fills `.hex` orders placed on Ethereum within about a minute and a half, claims the bridge messages
the `.hex` contracts send to Ethereum, and copies name changes on PulseChain over to Ethereum.

**It runs on Railway**, set up in a browser: [deploy/bot/README.md](../deploy/bot/README.md), with
what to fund it with on each network.

To run it on a computer instead, with [Node.js](https://nodejs.org) 22 or later, in this folder:

```bash
npm ci
```

```bash
cp .env.example .env
```

Fill in `.env` from the deploy run summaries (each step's **For the bot** block), then:

```bash
npm start
```

It prints its wallet, its network, and the public key websites seal orders to. That key is made from
`BOT_PRIVATE_KEY`, so there's no other key to keep. `npm run keygen` makes a separate one, if you'd
rather set `BOT_ENCRYPTION_SECRET_KEY` yourself.

**Testnet.** Set `NETWORK=testnet` to run it on PulseChain Testnet v4 and Sepolia, with the testnet
bridge. Give it its own wallet, `.env` and `STATE_FILE`, and set `PULSECHAIN_USDC` to the "USDC from
Sepolia" address step 1 printed. On Railway, the state file goes on the attached volume by itself.

| File | What it does |
|---|---|
| `src/orders.ts` | reads orders on Ethereum, commits and fills them on PulseChain, refunds the ones it can't fill |
| `src/relay.ts` | claims signed bridge messages on Ethereum, skipping ones that would change nothing |
| `src/sync.ts` | copies registrations, renewals and transfers made outside the checkouts |
| `src/reveal.ts` | the sealed order details, their registrar commitment, and the bot's encryption key |
| `src/buy.ts` | for websites: everything needed to place an order from Ethereum |
| `src/amb.ts` | the bridge's message and signature formats |
| `src/config.ts` | the settings, from environment variables (see `.env.example`) |

`npm test` type-checks and runs the tests. `npm run check-claim` simulates claiming a real, signed
bridge message on Ethereum, to check the claim code against the live mainnet bridge (it sends nothing).
