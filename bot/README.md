# The .hex bot

Fills `.hex` orders placed on Ethereum within about a minute and a half, claims the bridge messages
the `.hex` contracts send to Ethereum, and copies name changes on PulseChain over to Ethereum.

See [Running the bot](../README.md#running-the-bot) in the main README for setup. In short:

```bash
npm ci
```

```bash
npm run keygen
```

```bash
cp .env.example .env
```

```bash
npm start
```

| File | What it does |
|---|---|
| `src/orders.ts` | reads orders on Ethereum, commits and fills them on PulseChain, refunds the ones it can't fill |
| `src/relay.ts` | claims signed bridge messages on Ethereum, skipping ones that would change nothing |
| `src/sync.ts` | copies registrations, renewals and transfers made outside the checkouts |
| `src/reveal.ts` | the sealed order details and their registrar commitment |
| `src/buy.ts` | for websites: everything needed to place an order from Ethereum |
| `src/amb.ts` | the bridge's message and signature formats |

`npm test` type-checks and runs the tests. `npm run check-claim` simulates claiming a real, signed
bridge message on Ethereum, to check the claim code against the live bridge (it sends nothing).
