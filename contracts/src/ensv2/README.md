# ensv2

The core of ENSv2, copied from [ensdomains/contracts-v2](https://github.com/ensdomains/contracts-v2)
at commit `48b3e2d` and changed to run on PulseChain. Every file keeps its original MIT licence
header.

## What's here

`access-control`, `erc1155`, `registrar`, `registry`, `resolver`, `reverse-registrar`,
`universalResolver`, `utils` and `CommonErrors.sol`, with the same layout as upstream.

Left out, because `.hex` doesn't use them:

- `migration/` and `registry/WrapperRegistry.sol`: moving names over from ENS v1.
- `dns/`: importing DNS names.
- `testnet/`.
- `registry/interfaces/IWrapperRegistry.sol`: nothing else uses it.

## Changes for PulseChain

PulseChain doesn't support the opcodes from Ethereum's March 2024 upgrade (`MCOPY`, `TSTORE`), so
everything is compiled with `evm_version = "shanghai"`. Two files used `mcopy` directly:

- `utils/LibMem.sol`: `copy` now uses plain loads and stores. It gives the same result as
  `mcopy`, including when the source and destination overlap, by copying back to front when the
  destination comes after the source. The remappings point the ENS library's own `LibMem` at this
  file, as upstream does. `test/LibMem.t.sol` checks it against a byte-by-byte reference.
- `resolver/PermissionedResolver.sol`: the two copies in `_resolveAlias` call `LibMem.copy`
  instead of `mcopy`. Both copy into newly allocated memory.

Nothing else is changed. The libraries are pinned to the commits upstream builds against, in
`../../install-deps.sh`.
