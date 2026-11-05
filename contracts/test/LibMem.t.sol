// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {LibMem} from "../src/ensv2/utils/LibMem.sol";

/// @notice Checks the copy routine that replaces `mcopy` on PulseChain against a simple
///         byte-by-byte reference, including copies where the source and destination overlap.
contract LibMemTest is Test {
    function testFuzz_CopyWithinOneBuffer(bytes memory data, uint256 srcOff, uint256 dstOff, uint256 len) public {
        vm.assume(data.length > 0);
        srcOff = bound(srcOff, 0, data.length - 1);
        dstOff = bound(dstOff, 0, data.length - 1);
        len = bound(len, 0, data.length - (srcOff > dstOff ? srcOff : dstOff));

        bytes memory expected = _referenceMove(data, srcOff, dstOff, len);
        bytes memory actual = bytes.concat(data);
        LibMem.copy(LibMem.ptr(actual) + dstOff, LibMem.ptr(actual) + srcOff, len);

        assertEq(actual, expected, "copy within one buffer");
    }

    function testFuzz_CopyBetweenBuffers(bytes memory from, bytes memory to, uint256 srcOff, uint256 dstOff, uint256 len)
        public
    {
        vm.assume(from.length > 0 && to.length > 0);
        srcOff = bound(srcOff, 0, from.length - 1);
        dstOff = bound(dstOff, 0, to.length - 1);
        uint256 room = from.length - srcOff < to.length - dstOff ? from.length - srcOff : to.length - dstOff;
        len = bound(len, 0, room);

        bytes memory expected = bytes.concat(to);
        for (uint256 i; i < len; ++i) {
            expected[dstOff + i] = from[srcOff + i];
        }
        bytes memory source = bytes.concat(from);
        bytes memory actual = bytes.concat(to);
        LibMem.copy(LibMem.ptr(actual) + dstOff, LibMem.ptr(source) + srcOff, len);

        assertEq(actual, expected, "copy between buffers");
        assertEq(source, from, "source left unchanged");
    }

    /// @dev Every length either side of the 32-byte word size, shifted both ways by up to a word.
    function test_OverlappingShiftsAroundWordSize() public {
        bytes memory data = new bytes(160);
        for (uint256 i; i < data.length; ++i) {
            data[i] = bytes1(uint8(i * 7 + 3));
        }
        for (uint256 len; len <= 66; ++len) {
            for (uint256 shift = 1; shift <= 33; ++shift) {
                _checkMove(data, 40, 40 + shift, len); // destination after the source
                _checkMove(data, 40 + shift, 40, len); // destination before the source
            }
        }
    }

    function _checkMove(bytes memory data, uint256 srcOff, uint256 dstOff, uint256 len) private pure {
        bytes memory expected = _referenceMove(data, srcOff, dstOff, len);
        bytes memory actual = bytes.concat(data);
        LibMem.copy(LibMem.ptr(actual) + dstOff, LibMem.ptr(actual) + srcOff, len);
        require(keccak256(actual) == keccak256(expected), "overlapping copy differs from reference");
    }

    /// @dev The reference: read the whole source range first, then write it, exactly like `mcopy`.
    function _referenceMove(bytes memory data, uint256 srcOff, uint256 dstOff, uint256 len)
        private
        pure
        returns (bytes memory out)
    {
        out = bytes.concat(data);
        bytes memory tmp = new bytes(len);
        for (uint256 i; i < len; ++i) {
            tmp[i] = data[srcOff + i];
        }
        for (uint256 i; i < len; ++i) {
            out[dstOff + i] = tmp[i];
        }
    }
}
