// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IRentPriceOracle} from "@ensv2/registrar/interfaces/IRentPriceOracle.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {HexNameRules} from "../../src/pulsechain/HexNameRules.sol";
import {HexTestBase} from "../helpers/HexTestBase.sol";

/// @notice New .hex names are at most 63 bytes, the most one part of a web address can hold, and
///         are paid for at most 5 years ahead.
contract NameRulesTest is HexTestBase {
    uint64 internal constant FIVE_YEARS = 5 * ONE_YEAR;

    function _name(uint256 n) internal pure returns (string memory) {
        bytes memory b = new bytes(n);
        for (uint256 i = 0; i < n; ++i) b[i] = bytes1(uint8(97 + (i % 26))); // a-z, over and over
        return string(b);
    }

    function test_theRegistrarAsksTheRules_andTheRulesAskTheOracle() public view {
        assertEq(address(hub.registrar.rentPriceOracle()), address(hub.rules));
        assertEq(address(hub.rules.ORACLE()), address(hub.oracle));
        assertEq(hub.rules.MAX_LENGTH(), 63);
        assertEq(hub.rules.MAX_TERM(), FIVE_YEARS);
        assertTrue(hub.rules.supportsInterface(type(IRentPriceOracle).interfaceId));
        assertTrue(hub.rules.supportsInterface(type(IERC165).interfaceId));
    }

    // ------------------------------------------------------------------------------------------
    // 63 bytes
    // ------------------------------------------------------------------------------------------

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

    function test_renewals_anyLength() public {
        _registerDirect("alice", alice, ONE_YEAR);
        uint64 expiry = hub.core.hexRegistry.findExpiry("alice");
        assertEq(
            hub.rules.getRenewPrice("alice", expiry, ONE_YEAR, plsUsdc),
            hub.oracle.getRenewPrice("alice", expiry, ONE_YEAR, plsUsdc)
        );
        // The length rule never refuses a renewal, whatever the name's length.
        assertEq(
            hub.rules.getRenewPrice(_name(200), expiry, ONE_YEAR, plsUsdc),
            hub.oracle.getRenewPrice(_name(200), expiry, ONE_YEAR, plsUsdc)
        );
    }

    // ------------------------------------------------------------------------------------------
    // 5 years ahead
    // ------------------------------------------------------------------------------------------

    function test_fiveYearsIsTheLongestRegistration() public {
        _registerDirect("alice", alice, FIVE_YEARS);
        assertEq(hub.core.hexRegistry.findExpiry("alice"), block.timestamp + FIVE_YEARS);

        uint64 tooLong = FIVE_YEARS + 1;
        vm.expectRevert(
            abi.encodeWithSelector(
                HexNameRules.TooFarAhead.selector, "bob", block.timestamp + tooLong, block.timestamp + FIVE_YEARS
            )
        );
        hub.registrar.getRegisterPrice("bob", tooLong, plsUsdc);
    }

    function test_renewals_upToFiveYearsAhead() public {
        _registerDirect("alice", alice, FIVE_YEARS);
        // Paid up 5 years ahead: no renewal fits yet.
        vm.expectRevert();
        hub.registrar.getRenewPrice("alice", ONE_YEAR, plsUsdc);

        // A year later there's room for a year again, and only a year.
        vm.warp(block.timestamp + ONE_YEAR);
        hub.registrar.getRenewPrice("alice", ONE_YEAR, plsUsdc);
        vm.expectRevert();
        hub.registrar.getRenewPrice("alice", ONE_YEAR + 1, plsUsdc);
    }

    function test_renewals_anOwnerCanAlwaysGetBackToFiveYears() public {
        _registerDirect("alice", alice, ONE_YEAR);
        // Expired, in its grace period: renewing for 5 years from its expiry is still allowed,
        // as it lands before 5 years from today.
        vm.warp(block.timestamp + ONE_YEAR + 10 days);
        hub.registrar.getRenewPrice("alice", FIVE_YEARS, plsUsdc);
        // And a name with 2 years left can add 3.
        _registerDirect("carol", alice, 2 * ONE_YEAR);
        hub.registrar.getRenewPrice("carol", 3 * ONE_YEAR, plsUsdc);
    }

    function test_theAdminStillSetsPrices_onTheOracle() public {
        // Payment tokens, for one, are still the oracle's: the rules only read them.
        assertTrue(hub.oracle.isPaymentToken(plsUsdc));
        vm.prank(admin);
        hub.oracle.updatePaymentToken(plsUsdc, 0, 0); // the admin takes USDC away
        vm.expectRevert();
        hub.registrar.getRegisterPrice("alice", ONE_YEAR, plsUsdc);
    }
}
