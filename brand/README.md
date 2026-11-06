# HexNS brand

The HexNS mark is **Bead**: a hexagon strung on a network line between two nodes, with a node at
its heart. Your name on the network, between PulseChain and Ethereum.

Every file is a single filled shape (no strokes), so it scales cleanly from a 16px favicon to a
billboard, in a browser or in any design tool.

## Files

| File | Use it for |
| --- | --- |
| `hexns-mark.svg` | The mark in colour, cropped tight. The default. |
| `hexns-mark-square.svg` | The mark in colour, centred in a square (avatars, favicons). |
| `hexns-mark-black.svg` | One colour, on light backgrounds. |
| `hexns-mark-white.svg` | One colour, on dark backgrounds or photos. |
| `hexns-app-icon.svg` / `-1024.png` | App icon: white mark on the gradient. |
| `hexns-app-icon-dark.svg` / `-1024.png` | App icon: colour mark on dark. |
| `hexns-mark-1024.png` | The mark in colour as a picture, transparent background. |

The website's own icons (favicon, phone home-screen icons) are in `web/public`, and the mark itself
is in `web/src/components/Logo.tsx`.

## Colours

| | |
| --- | --- |
| Gradient, left to right | `#FFC400` → `#FF6A1F` → `#E5007A` |
| Dark | `#1D1424` (icons), `#130B18` (site background) |
| Light | `#FFF9F4` (site background) |

## Using it

- Leave space around the mark at least the width of one of its side nodes.
- Smallest sizes: 16px tall for the mark on its own, 16px for the square favicon.
- Use the files as they are: no other colours, outlines, shadows or stretching.
- On photos or busy backgrounds, use the white mark.

## How it's drawn

On a 64-unit grid: a flat-topped hexagon with corners 15.5 from its centre, drawn with a 5.8-unit
line and rounded outer corners; a line through its side corners out to two nodes of radius 5.4 at
x = 8 and x = 56; a node of radius 5.2 at the centre. The gradient runs from (4, 22) to (60, 42).
