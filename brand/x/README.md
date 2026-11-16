# HexNS on X

The profile picture, header and bio for the HexNS account on X (Twitter), matched to the promo video
in [`promo/`](../../promo/README.md).

| File | Use it for |
| --- | --- |
| `hexns-x-avatar.png` | The profile picture, 1000 × 1000. X crops it to a circle. |
| `hexns-x-avatar-400.png` | The same at X's own size, 400 × 400. |
| `hexns-x-avatar-dark.png` | A dark alternative. It disappears on X's black theme, so prefer the gradient one. |
| `hexns-x-banner.png` | The header, 1500 × 500. |
| `src/` | Their sources: the pictures as SVG, the header as a web page. |

## The profile

- **Name:** HexNS
- **Bio** (146 of 160 characters): One name. Both chains. Swap your 0x… for yourname.hex on PulseChain
  and Ethereum, from $10 a year. Built on ENSv2. Independent, made for Hexicans.
- **Location:** PulseChain + Ethereum
- **Website:** hexns.domains

"Independent" keeps it clear that HexNS isn't run by HEX or PulseChain, as the site's footer says.

## The picture

The site's app icon (`../hexns-app-icon.svg`): the white mark on the gradient, with the mark a little
larger (0.70 of the tile, not 0.62) so it still reads at 48px in the feed.

## The header

The words stay inside x 200–1300 and y 70–430: X puts the profile picture over the bottom left, and
phones put their buttons over the top corners. The "Available" chip sits 22px in from the search
bar's top, bottom and right, so its rounded end nests in the bar's. A light grain stops the
gradients banding when X re-compresses the picture.

To change it, edit `src/banner.html` and save it again as a 1500 × 500 picture (or ask Claude).
