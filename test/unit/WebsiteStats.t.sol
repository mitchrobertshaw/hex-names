// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {IRegistryEvents} from "@ensv2/registry/interfaces/IRegistryEvents.sol";

/// @notice The homepage counts names from the .hex registry's LabelRegistered events
///         (web/src/lib/stats.ts). This checks it listens for the event the registry really emits.
contract WebsiteStatsTest is Test {
    function test_theWebsiteCountsTheRegistrysRegistrations() public {
        string memory source = vm.readFile("web/src/lib/stats.ts");
        string memory topic = vm.toString(IRegistryEvents.LabelRegistered.selector);
        assertTrue(vm.contains(source, topic), "web/src/lib/stats.ts must listen for LabelRegistered");
    }
}
