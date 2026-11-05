// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {console} from "forge-std/Script.sol";

import {EthereumAddresses as E} from "./Addresses.sol";
import {DeployScript} from "./DeployScript.sol";
import {HexMirrorRegistrar} from "../src/ethereum/HexMirrorRegistrar.sol";
import {HexOrderBook} from "../src/ethereum/HexOrderBook.sol";
import {HexMirrorSync} from "../src/pulsechain/HexMirrorSync.sol";
import {HexOrderFiller} from "../src/pulsechain/HexOrderFiller.sol";

/// @notice Step 3 of 3: links the PulseChain contracts to their Ethereum partners, for good.
/// @dev Environment:
///        PULSECHAIN_MIRROR_SYNC     required. From step 1.
///        PULSECHAIN_ORDER_FILLER    required. From step 1.
///        ETHEREUM_MIRROR_REGISTRAR  required. From step 2.
///        ETHEREUM_ORDER_BOOK        required. From step 2.
///        ETHEREUM_RPC_URL           optional. Used to check the Ethereum addresses first.
///        DEPLOYER_PRIVATE_KEY       optional. The same key as steps 1 and 2.
contract LinkPulseChain is DeployScript {
    function run() external {
        require(block.chainid == PULSECHAIN_CHAIN_ID, "not PulseChain (chain id 369)");
        HexMirrorSync sync = HexMirrorSync(vm.envAddress("PULSECHAIN_MIRROR_SYNC"));
        HexOrderFiller filler = HexOrderFiller(vm.envAddress("PULSECHAIN_ORDER_FILLER"));
        address ethMirrorRegistrar = vm.envAddress("ETHEREUM_MIRROR_REGISTRAR");
        address ethOrderBook = vm.envAddress("ETHEREUM_ORDER_BOOK");
        require(sync.peer() == address(0) && filler.peer() == address(0), "already linked");

        (uint256 here,) = _onOtherChain("ETHEREUM_RPC_URL", "https://ethereum-rpc.publicnode.com");
        require(
            address(HexMirrorRegistrar(ethMirrorRegistrar).AMB()) == E.AMB,
            "ETHEREUM_MIRROR_REGISTRAR is not a .hex HexMirrorRegistrar"
        );
        require(address(HexOrderBook(ethOrderBook).AMB()) == E.AMB, "ETHEREUM_ORDER_BOOK is not a .hex HexOrderBook");
        require(
            HexMirrorRegistrar(ethMirrorRegistrar).peer() == address(sync),
            "the Ethereum copy is not linked to this HexMirrorSync"
        );
        require(
            HexOrderBook(ethOrderBook).peer() == address(filler),
            "the Ethereum order book is not linked to this HexOrderFiller"
        );
        vm.selectFork(here);

        _startBroadcast();
        sync.link(ethMirrorRegistrar);
        filler.link(ethOrderBook);
        vm.stopBroadcast();

        console.log("Linked. .hex is live on both chains.");
    }
}
