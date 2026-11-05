// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

// solhint-disable no-inline-assembly

/// @dev Low-level memory helpers for copying, pointer conversion, and word loading.
library LibMem {
    /// @dev If true, the ENS library's LibMem imports resolve to this library.
    bool internal constant REMAPPED = true;

    /// @dev Copy `mem[src:src+len]` to `mem[dst:dst+len]`. Gives the same result as `mcopy`,
    ///      including when the two ranges overlap, using only loads and stores, so it runs on
    ///      chains without the Cancun opcodes.
    /// @param src The source memory offset.
    /// @param dst The destination memory offset.
    /// @param len The number of bytes to copy.
    function copy(uint256 dst, uint256 src, uint256 len) internal pure {
        assembly {
            switch gt(dst, src)
            case 0 {
                // Destination at or before the source: copy front to back.
                // prettier-ignore
                for {} gt(len, 31) {} {
                    mstore(dst, mload(src))
                    dst := add(dst, 32)
                    src := add(src, 32)
                    len := sub(len, 32)
                }
                if len {
                    // Take the first bytes of the source word and keep the rest of the destination word.
                    let mask := sub(shl(shl(3, sub(32, len)), 1), 1)
                    mstore(dst, or(and(mload(src), not(mask)), and(mload(dst), mask)))
                }
            }
            default {
                // Destination after the source: copy back to front, so an overlapping source is
                // read before it is overwritten.
                let d := add(dst, len)
                let s := add(src, len)
                // prettier-ignore
                for {} gt(len, 31) {} {
                    d := sub(d, 32)
                    s := sub(s, 32)
                    mstore(d, mload(s))
                    len := sub(len, 32)
                }
                if len {
                    let mask := sub(shl(shl(3, sub(32, len)), 1), 1)
                    mstore(dst, or(and(mload(src), not(mask)), and(mload(dst), mask)))
                }
            }
        }
    }

    /// @dev Convert bytes to a memory offset.
    /// @param v The bytes to convert.
    /// @return ret The corresponding memory offset.
    function ptr(bytes memory v) internal pure returns (uint256 ret) {
        assembly {
            ret := add(v, 32)
        }
    }

    /// @dev Read word at memory offset.
    /// @param src The memory offset.
    /// @return ret The read word.
    function load(uint256 src) internal pure returns (uint256 ret) {
        assembly {
            ret := mload(src)
        }
    }
}
