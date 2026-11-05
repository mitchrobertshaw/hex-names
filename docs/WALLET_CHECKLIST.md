# Wallet checklist

Only MetaMask has Snaps. Every other wallet has to add `.hex` lookups in its own code, so each one is
a separate ask. The list below is what to have ready first, then who to approach.

## Before approaching anyone

- [ ] The registry is live on PulseChain and its contracts are verified on the block explorer.
- [ ] The registry's admin roles are given up, so nobody can seize `.hex`.
- [ ] There's an ENS-compatible lookup contract at a published address. A wallet that already
      handles ENS can then add `.hex` mostly by changing an address.
- [ ] Reverse records work (address to name), so wallets can show `alice.hex` instead of `0x…`.
- [ ] The JavaScript library is on npm, with a one-page integration guide.
- [ ] A public test page lets anyone type a name and see its address.
- [ ] No other name system sells `.hex`. Pulse Domains doesn't use it; also check Handshake,
      Freename and Unstoppable Domains.
- [ ] The "`.hex` names never end in `.eth`" message is on the website and in the docs.

## Wallets

- [ ] **MetaMask:** build a name-lookup Snap for PulseChain and Ethereum, covering the `hex` ending,
      and submit it for MetaMask's approval (they may ask for an audit). Add an install button to
      the website. Consider having it look up `.pls` too, through Pulse Domains, so it's useful to
      everyone on PulseChain.
- [ ] **Internet Money:** ask the team to add `.hex` lookups to the send screen, and give them the
      library and the lookup contract's address.
- [ ] **ZKX Web3 Wallet:** a browser extension that supports PulseChain, with about 1,000 to 2,000
      users. Check who makes it before linking the project to it; there are scam warnings around a
      "ZKX" token.
- [ ] **OKX Wallet:** announced a PulseChain partnership.
- [ ] **Rabby, Trust Wallet and TokenPocket.**

## Not wallets, but just as important

- [ ] PulseChain's block explorer, so it shows `.hex` names next to addresses.
- [ ] The send and transfer fields on PulseX, Piteas and LibertySwap.

## Later, optional

- [ ] `alice.hex.eth`, if `hex.eth` is ever acquired. See [ARCHITECTURE.md](ARCHITECTURE.md).
