// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {EthereumAddresses as E, PulseChainAddresses as P} from "./Addresses.sol";
import {DeployScript} from "./DeployScript.sol";
import {IAMB} from "../src/interfaces/IAMB.sol";
import {HexMirrorSync} from "../src/pulsechain/HexMirrorSync.sol";
import {HexOrderFiller} from "../src/pulsechain/HexOrderFiller.sol";

/// @notice Step 2 of 3: deploys the Ethereum side of .hex and links it to PulseChain.
/// @dev Environment:
///        ADMIN                    required. On Ethereum it only owns the gateway list and the
///                                 contract namer; it has no say over names.
///        PULSECHAIN_MIRROR_SYNC   required. From step 1.
///        PULSECHAIN_ORDER_FILLER  required. From step 1.
///        PULSECHAIN_RPC_URL       optional. Used to check those two addresses first.
///        DEPLOYER_PRIVATE_KEY     optional. The same key as step 1.
contract DeployEthereum is DeployScript {
    function run() external returns (Mirror memory mirror) {
        require(block.chainid == ETHEREUM_CHAIN_ID, "not Ethereum mainnet (chain id 1)");
        address admin = vm.envAddress("ADMIN");
        address plsMirrorSync = vm.envAddress("PULSECHAIN_MIRROR_SYNC");
        address plsOrderFiller = vm.envAddress("PULSECHAIN_ORDER_FILLER");
        _requireCanHoldTokens(admin, "ADMIN");
        _requireCode(E.AMB, "The bridge");
        _requireCode(E.USDC, "USDC");
        _requireCode(E.WETH, "WETH");
        _requireCode(E.UNISWAP_V2_ROUTER, "Uniswap V2");

        uint256 key = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        address deployer = key != 0 ? vm.addr(key) : msg.sender;
        _checkPulseChain(plsMirrorSync, plsOrderFiller, deployer);

        address[] memory routers = new address[](1);
        routers[0] = E.UNISWAP_V2_ROUTER;

        _startBroadcast();
        mirror = _deployMirror(
            MirrorConfig({
                deployer: deployer,
                admin: admin,
                amb: IAMB(E.AMB),
                usdc: IERC20(E.USDC),
                weth: IERC20(E.WETH),
                routers: routers,
                fillWindow: FILL_WINDOW,
                reclaimDelay: RECLAIM_DELAY
            })
        );
        mirror.mirrorRegistrar.link(plsMirrorSync);
        mirror.orderBook.link(plsOrderFiller);
        vm.stopBroadcast();

        console.log("");
        console.log("=== .hex on Ethereum ===");
        console.log("ETHEREUM_MIRROR_REGISTRAR", address(mirror.mirrorRegistrar));
        console.log("ETHEREUM_ORDER_BOOK      ", address(mirror.orderBook));
        console.log("UniversalResolver        ", address(mirror.core.universalResolver));
        console.log(".hex registry (copy)     ", address(mirror.core.hexRegistry));
        console.log("Root registry            ", address(mirror.core.rootRegistry));
        console.log("Default resolver         ", address(mirror.core.ownerResolver));
        console.log("Resolver factory         ", address(mirror.core.verifiableFactory));
        console.log("Resolver implementation  ", address(mirror.core.resolverImplementation));
        console.log("Next: step 3 (link PulseChain) with the first two addresses.");
    }

    /// @dev Makes sure the step 1 addresses are the real, unlinked PulseChain contracts, deployed
    ///      by the same key, before linking to them for good.
    function _checkPulseChain(address plsMirrorSync, address plsOrderFiller, address deployer) internal {
        (uint256 here,) = _onOtherChain("PULSECHAIN_RPC_URL", "https://rpc.pulsechain.com");
        HexMirrorSync sync = HexMirrorSync(plsMirrorSync);
        HexOrderFiller filler = HexOrderFiller(plsOrderFiller);
        require(address(sync.AMB()) == P.AMB, "PULSECHAIN_MIRROR_SYNC is not a .hex HexMirrorSync");
        require(address(filler.AMB()) == P.AMB, "PULSECHAIN_ORDER_FILLER is not a .hex HexOrderFiller");
        require(sync.PEER_CHAIN_ID() == ETHEREUM_CHAIN_ID && filler.PEER_CHAIN_ID() == ETHEREUM_CHAIN_ID, "wrong chain");
        require(sync.LINKER() == deployer && filler.LINKER() == deployer, "step 1 used a different deployer key");
        require(sync.peer() == address(0) && filler.peer() == address(0), "already linked to something else");
        require(address(filler.MIRROR_SYNC()) == plsMirrorSync, "the two addresses are from different deployments");
        vm.selectFork(here);
    }
}
