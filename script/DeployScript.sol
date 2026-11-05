// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {HexDeployer} from "./HexDeployer.sol";

/// @notice What the three deploy scripts share: who is deploying, and the checks run first.
abstract contract DeployScript is Script, HexDeployer {
    /// @dev Gas each bridge message asks for on Ethereum. Each uses well under half of this (see
    ///      the tests); only the gas actually used is paid for.
    uint256 internal constant MIRROR_GAS = 1_000_000;
    uint256 internal constant SETTLE_GAS = 300_000;
    /// @dev How long a filler has to register an Ethereum order's name, and how long after that a
    ///      buyer must wait to take an unsettled order's money back.
    uint64 internal constant FILL_WINDOW = 30 minutes;
    uint64 internal constant RECLAIM_DELAY = 6 hours;

    /// @dev Starts broadcasting from DEPLOYER_PRIVATE_KEY, or simulates if it is not set.
    function _startBroadcast() internal returns (address deployer) {
        uint256 key = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (key != 0) {
            deployer = vm.addr(key);
            vm.startBroadcast(key);
        } else {
            deployer = msg.sender;
            vm.startBroadcast();
        }
        console.log("Deployer:", deployer);
    }

    /// @dev The admin receives the `hex` token, so it must be able to hold it: a plain wallet, or
    ///      a contract wallet such as a Safe that accepts ERC-1155 tokens.
    function _requireCanHoldTokens(address account, string memory what) internal view {
        require(account != address(0), string.concat(what, " is not set"));
        if (account.code.length == 0) return;
        bool ok;
        try IERC165(account).supportsInterface(type(IERC1155Receiver).interfaceId) returns (bool yes) {
            ok = yes;
        } catch {}
        require(ok, string.concat(what, " is a contract that cannot hold ERC-1155 tokens; use a wallet or a Safe"));
    }

    function _requireCode(address account, string memory what) internal view {
        require(account.code.length != 0, string.concat(what, " has no contract code on this chain"));
    }

    /// @dev Reads contracts on the other chain, then switches back. For checking addresses before
    ///      linking to them.
    function _onOtherChain(string memory rpcEnv, string memory defaultRpc)
        internal
        returns (uint256 here, uint256 there)
    {
        here = vm.activeFork();
        there = vm.createSelectFork(vm.envOr(rpcEnv, defaultRpc));
    }
}
