// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IRentPriceOracle} from "@ensv2/registrar/interfaces/IRentPriceOracle.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {HexNameLengthCap} from "../../src/pulsechain/HexNameLengthCap.sol";
import {HexTestBase} from "../helpers/HexTestBase.sol";

/// @notice New .hex names are at most 63 bytes: the most one part of a web address can hold.
contract NameLengthTest is HexTestBase {
    function _name(uint256 n) internal pure returns (string memory) {
        bytes memory b = new bytes(n);
        for (uint256 i = 0; i < n; ++i) b[i] = bytes1(uint8(97 + (i % 26))); // a-z, over and over
        return string(b);
    }

    function test_theRegistrarAsksTheCap_andTheCapAsksTheOracle() public view {
        assertEq(address(hub.registrar.rentPriceOracle()), address(hub.lengthCap));
        assertEq(address(hub.lengthCap.ORACLE()), address(hub.oracle));
        assertEq(hub.lengthCap.MAX_LENGTH(), 63);
        assertTrue(hub.lengthCap.supportsInterface(type(IRentPriceOracle).interfaceId));
        assertTrue(hub.lengthCap.supportsInterface(type(IERC165).interfaceId));
    }

    function test_63IsTheLongestName() public {
        string memory longest = _name(63);
        (uint256 base,) = hub.registrar.getRegisterPrice(longest, ONE_YEAR, plsUsdc);
        (uint256 short,) = hub.registrar.getRegisterPrice("alice", ONE_YEAR, plsUsdc);
        assertEq(base, short, "a long name costs what any name of 5 or more costs");
        _registerDirect(longest, alice, ONE_YEAR);
        assertEq(hub.core.hexRegistry.findOwner(longest), alice);
    }

    function test_64IsTooLong() public {
        string memory tooLong = _name(64);
        vm.expectRevert(abi.encodeWithSelector(IRentPriceOracle.NotValid.selector, tooLong));
        hub.registrar.getRegisterPrice(tooLong, ONE_YEAR, plsUsdc);
        vm.expectRevert(abi.encodeWithSelector(IRentPriceOracle.NotValid.selector, _name(255)));
        hub.registrar.getRegisterPrice(_name(255), ONE_YEAR, plsUsdc);
    }

    function test_bytesCount_notLetters() public {
        // 21 emoji of 4 bytes each: 84 bytes, too long, though it's 21 characters.
        string memory emoji;
        for (uint256 i = 0; i < 21; ++i) emoji = string.concat(emoji, unicode"🔥");
        vm.expectRevert(abi.encodeWithSelector(IRentPriceOracle.NotValid.selector, emoji));
        hub.registrar.getRegisterPrice(emoji, ONE_YEAR, plsUsdc);
        // 15 of them is 60 bytes: fine.
        string memory fifteen;
        for (uint256 i = 0; i < 15; ++i) fifteen = string.concat(fifteen, unicode"🔥");
        hub.registrar.getRegisterPrice(fifteen, ONE_YEAR, plsUsdc);
    }

    function test_renewalsPassStraightThrough() public {
        _registerDirect("alice", alice, ONE_YEAR);
        uint64 expiry = hub.core.hexRegistry.findExpiry("alice");
        assertEq(
            hub.lengthCap.getRenewPrice("alice", expiry, ONE_YEAR, plsUsdc),
            hub.oracle.getRenewPrice("alice", expiry, ONE_YEAR, plsUsdc)
        );
        // The cap never refuses a renewal, whatever the name's length.
        assertEq(
            hub.lengthCap.getRenewPrice(_name(200), expiry, ONE_YEAR, plsUsdc),
            hub.oracle.getRenewPrice(_name(200), expiry, ONE_YEAR, plsUsdc)
        );
    }

    function test_theAdminStillSetsPrices_onTheOracle() public {
        // Payment tokens, for one, are still the oracle's: the cap only reads them.
        assertTrue(hub.oracle.isPaymentToken(plsUsdc));
        vm.prank(admin);
        hub.oracle.updatePaymentToken(plsUsdc, 0, 0); // the admin takes USDC away
        vm.expectRevert();
        hub.registrar.getRegisterPrice("alice", ONE_YEAR, plsUsdc);
    }
}
