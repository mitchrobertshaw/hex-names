# HexNS website

The Hex Name Service website: the homepage at hexns.domains, made for Hexicans, and the app at
app.hexns.domains, where names are bought and managed. Built with Vite, React and TypeScript.

## The app

[`app/index.html`](app/index.html) and [`src/app`](src/app). One page with three views:

- **Search** (`/`): find a name, and see the names just registered.
- **A name** (`/alice.hex`): if it's free, choose how long, which chain to pay from and which
  token, see exactly what it costs, and buy it. From PulseChain that's: reserve it, wait a minute
  (the token is allowed meanwhile), pay ([`flows.ts`](src/app/flows.ts)). From Ethereum it's one
  order, sealed so only the bot can read which name it is, which the bot fills on PulseChain within
  about a minute and a half. If it's taken: who owns it and until when. If it's yours: renew it,
  send it to another wallet, and your referral link.
- **My names** (`/names`): the names in the connected wallet, from the site's index of the registry.

Wallets: any browser wallet that announces itself (MetaMask, Rabby, Internet Money and others) or
sits at `window.ethereum` ([`wallet.ts`](src/app/wallet.ts)). Phone wallets by QR code need
WalletConnect, which needs a project ID from reown.com.

**Switching it on.** Fill in [`src/deployment.ts`](src/deployment.ts) from the deploy run summaries
and the bot's `npm run keygen`. Until then the app searches and prices names, connects wallets, and
plays a purchase through as a walkthrough that sends nothing. For a testnet copy, fill in `testnet`
and set `VITE_NETWORK=testnet` in Netlify's environment variables.

**Where it lives.** On Netlify, add `app.hexns.domains` as a second domain of this same site:
[`public/_redirects`](public/_redirects) serves the app there, and under `/app` on preview links.

**Referral links.** `hexns.domains/?ref=alice` or `app.hexns.domains/?ref=alice`, where `alice` is
the referrer's .hex name ([`src/lib/referral.ts`](src/lib/referral.ts)). The visitor's browser
remembers it for 44 days, and their purchase or renewal carries it to the registrar as its referral
tag, `keccak256("alice")`, recorded on-chain in the registrar's `NameRegistered` and `NameRenewed`
events with the amount paid. Referrers are paid from those records.

**Tested end to end** on local copies of PulseChain Testnet v4 and Sepolia with the real contracts
and the bot: buying on PulseChain with USDC, ordering from Sepolia with ETH (filled by the bot),
renewing, sending, My names, and a referral tag landing on-chain.

## Putting it on Netlify

Nothing needs installing: Netlify builds the site from GitHub.

1. Sign in at [netlify.com](https://www.netlify.com) with your GitHub account.
2. **Add new site > Import an existing project > GitHub**, and pick `hex-names`.
3. Netlify reads the settings from [`netlify.toml`](../netlify.toml) (build in `web/`, publish
   `web/dist`). Leave the branch as `main` and click **Deploy**.
4. In **Site configuration > Change site name**, pick a name such as `hexns`, for
   `hexns.netlify.app`.
5. Later, in **Domain management > Add a domain**, add `hexns.domains` and follow Netlify's DNS
   steps at the place you bought the domain.

Every push to `main` then redeploys the site, and every pull request gets its own preview link.

## Changing things

- **The floating names** are HEX KOLs, listed in [`src/data/featured.ts`](src/data/featured.ts)
  with their X handles. After adding someone, run `npm run avatars` to save their profile picture
  into `src/assets/avatars` (or ask Claude to). Every person shown must also be in
  [`../script/reserved-names.csv`](../script/reserved-names.csv), so nobody can buy their name
  first; the tests check both. A name and photo on the homepage reads as that person backing
  HexNS, so it's worth asking them first. On wide screens the first six drift around the words
  ([`FloatingNames.tsx`](src/components/FloatingNames.tsx)): drag one and it springs back to its
  place when let go; click one and it hops and settles. On phones everyone scrolls past in a row,
  and a tap makes a name hop.
- **The background** at the top of the page is a light wash of the HEX colours that drifts
  slowly (`.hero::before` in [`src/styles.css`](src/styles.css), coloured by the `--hero-`
  variables for light and dark). It stays still for visitors who turn off motion.
- **The `.hex` on each floating name** is in that person's colour, picked from their profile
  picture: `tone` in [`src/data/featured.ts`](src/data/featured.ts), one shade for light and one
  for dark, each easy to read on its background (the tests check).
- **The live strip** under the search ("● LIVE · names registered · the latest names", in
  [`LiveStrip.tsx`](src/components/LiveStrip.tsx)) comes straight from the `.hex` registry on
  PulseChain, through the site's own function at `/api/stats`
  ([`netlify/functions/stats.mts`](netlify/functions/stats.mts)). It switches itself on once the
  registry's address and start block from step 1's summary are filled in to
  [`src/deployment.ts`](src/deployment.ts), and stays hidden until then. The total shows from 100
  names and the day's count from 10, so it never shows a small number. Only names made of plain
  letters, digits and hyphens, with nothing rude or scammy in them, appear in it. The function
  reads at most about once a minute and keeps its place in Netlify Blobs, which needs no setting
  up. For a copy of the site on the testnet, set `VITE_NETWORK=testnet` in Netlify's environment
  variables.
- **The HexNS mark**, "Route", is in [`src/components/Logo.tsx`](src/components/Logo.tsx); the
  browser and phone icons made from it are in [`public`](public), and every version of it, with
  how to use it, is in [`../brand`](../brand).
- **The chain logos** are PulseChain's and Ethereum's own, in [`src/assets/chains`](src/assets/chains):
  PulseChain's is the PLS mark from PulseX's token list (the same as pulsechain.com's icon), and
  Ethereum's is `eth-diamond-purple.svg` from [ethereum.org/assets](https://ethereum.org/assets/).
  They only show which chains a name works on; the footer says HexNS isn't affiliated with either.
- **The chat** ("Goodbye 0x…", in [`Messages.tsx`](src/components/Messages.tsx)) and **the name
  card** ("Yours. Not ours.", in [`Ownership.tsx`](src/components/Ownership.tsx)) are small
  demos. A name typed into the chat shows on the card too.
- **The search** on the homepage checks a name as it's typed, and its Register button opens that
  name in the app. Prices and discounts are in [`src/lib/names.ts`](src/lib/names.ts), and the
  tests check them against `script/HexDeployer.sol` and the bot's order fee. Tokens and the swap
  routes are in [`src/lib/tokens.ts`](src/lib/tokens.ts), for mainnet and the testnets; live
  quotes ask PulseX and Uniswap through public RPCs ([`src/lib/quotes.ts`](src/lib/quotes.ts)).
- **Light and dark**: the moon and sun button in the top bar switches between them and remembers
  the choice. Until a visitor picks, the site follows their device's setting.
- **Reserved names** come straight from `script/reserved-names.csv`, the same list the contracts
  are deployed with, so the search marks exactly those names as reserved.
- **Words on the page** are in [`src/components`](src/components): the top of the page in
  `Hero.tsx`, the chat in `Messages.tsx`, the name card in `Ownership.tsx`, and the other sections
  in `Sections.tsx`.
- **Colours and layout** are in [`src/styles.css`](src/styles.css), with light and dark versions at
  the top.

## Running it yourself

Optional, with Node.js 22 or later:

```bash
npm ci
```

```bash
npm run dev
```

`npm test` runs the tests, which GitHub also runs on every push, and `npm run build` makes the
site in `dist/`: the homepage, and the app in `dist/app/` (open `/app/` in `npm run dev`).

`npm run build:single` makes the homepage as one file, `dist-single/index.html`, with everything
inside it: scripts, styles, fonts and pictures. It opens straight from a computer by
double-clicking, so it's handy for sharing a preview.
