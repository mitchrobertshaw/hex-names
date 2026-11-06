# HexNS website

The Hex Name Service website, for hexns.domains: a landing page made for Hexicans, with a name
search that checks names against the same rules the contracts use. Built with Vite, React and
TypeScript.

Until the contracts are live, the search says whether a name will be available at launch, premium,
reserved or invalid, and buying shows "Opens at launch". Buying and managing names come once the
contracts are deployed: switch `LAUNCHED` in [`src/site.ts`](src/site.ts) then.

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
  HexNS, so it's worth asking them first.
- **The 3D HEX logo** behind the top of the page is drawn by [`src/three/scene.ts`](src/three/scene.ts),
  from the logo on [hex.com/downloads](https://hex.com/downloads) (hex.com licenses it under fair
  use). How see-through it is, in light and dark, is `--scene-logo-opacity` in `src/styles.css`. It
  loads after the rest of the page, pauses when scrolled away, stays still for visitors who turn
  off motion, and is simply left out on devices without WebGL.
- **Light and dark**: the moon and sun button in the top bar switches between them and remembers
  the choice. Until a visitor picks, the site follows their device's setting.
- **Reserved names** come straight from `script/reserved-names.csv`, the same list the contracts
  are deployed with, so the search marks exactly those names as reserved.
- **Words on the page** are in [`src/components`](src/components): the top of the page in
  `Hero.tsx`, the sections below it in `Sections.tsx`.
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
site in `dist/`.

`npm run build:single` makes the whole site as one file, `dist-single/index.html`, with everything
inside it: scripts, styles, fonts, pictures and the 3D scene. It opens straight from a computer by
double-clicking, so it's handy for sharing a preview.
