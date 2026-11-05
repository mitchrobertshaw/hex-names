# hex-names

`.hex` names for PulseChain, with an Ethereum copy that stays in step automatically. A name costs
$5 a year, paid in any token, from either chain.

> **`.hex` names never end in `.eth`.** `alice.hex` and `alice.hex.eth` are different names, and
> this project doesn't control `hex.eth`. When sending to someone's `.hex` name, type it exactly as
> `name.hex`.

## How it works

- **One registry on PulseChain is the source of truth.** Buying, renewing, selling and changing
  addresses all happen there.
- **An Ethereum copy follows it within a minute or two.** It only accepts updates signed by the
  project's signing key, and nobody can buy or change names on it directly.
- **Buyers pay once, on the chain they're on,** with whatever token they hold. A relayer does the
  work on the other chain, and its gas is part of the price.
- **Wallets look names up** through a MetaMask Snap and a small JavaScript library, for sends on
  both PulseChain and Ethereum.

The full design, and the reasoning behind each choice, is in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Status

| Piece | Folder | Status |
|---|---|---|
| Pay-with-any-token checkout | `contracts/` | Built and tested, not deployed |
| PulseChain registry (ENSv2, ported) | `contracts/` | Built and tested, not deployed |
| Ethereum copy | `contracts/` | Next |
| Ethereum checkout | `contracts/` | Not started |
| Relayer | `relayer/` | Not started |
| MetaMask Snap | `snap/` | Not started |
| JavaScript library | `sdk/` | Not started |
| Website | `web/` | Not started |

Folders appear as each piece is built. Nothing here is audited: don't put real money through it
until it has been independently reviewed.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the pieces fit, what keeps the two chains in
  step, the keys, and the decisions still open.
- [docs/WALLET_CHECKLIST.md](docs/WALLET_CHECKLIST.md): what to have ready, and who to ask, so
  wallets support `.hex` names.
- [contracts/README.md](contracts/README.md): the contracts, how to run the tests, and how to deploy
  without installing anything.

## License

MIT. See [LICENSE](LICENSE).
