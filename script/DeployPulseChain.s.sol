// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {PulseChainAddresses as P} from "./Addresses.sol";
import {DeployScript} from "./DeployScript.sol";
import {IAMB} from "../src/interfaces/IAMB.sol";

/// @notice Step 1 of 3: deploys .hex on PulseChain, where names live and are sold.
/// @dev Environment:
///        ADMIN                 required. May change prices and payment tokens and add registrars
///                              later; can never take, move or unregister a name.
///        BENEFICIARY           optional. Receives every payment. Defaults to ADMIN.
///        DEPLOYER_PRIVATE_KEY  optional. Without it, run without --broadcast for a dry run.
///      Use the same deployer key for steps 2 and 3: it is the only key that can link the two
///      chains together, once.
contract DeployPulseChain is DeployScript {
    function run() external returns (Hub memory hub) {
        require(block.chainid == PULSECHAIN_CHAIN_ID, "not PulseChain (chain id 369)");
        address admin = vm.envAddress("ADMIN");
        address beneficiary = vm.envOr("BENEFICIARY", admin);
        _requireCanHoldTokens(admin, "ADMIN");
        require(beneficiary != address(0), "BENEFICIARY is not set");
        _requireCode(P.AMB, "The bridge");
        _requireCode(P.USDC, "USDC");
        _requireCode(P.DAI, "DAI");
        _requireCode(P.WPLS, "WPLS");
        _requireCode(P.PULSEX_V1_ROUTER, "PulseX V1");
        _requireCode(P.PULSEX_V2_ROUTER, "PulseX V2");

        address[] memory routers = new address[](2);
        routers[0] = P.PULSEX_V1_ROUTER;
        routers[1] = P.PULSEX_V2_ROUTER;

        address deployer = _startBroadcast();
        hub = _deployHub(
            HubConfig({
                deployer: deployer,
                admin: admin,
                beneficiary: beneficiary,
                amb: IAMB(P.AMB),
                usdc: IERC20(P.USDC),
                dai: IERC20(P.DAI),
                wpls: IERC20(P.WPLS),
                routers: routers,
                mirrorGas: MIRROR_GAS,
                settleGas: SETTLE_GAS
            })
        );
        vm.stopBroadcast();

        console.log("");
        console.log("=== .hex on PulseChain ===");
        console.log("PULSECHAIN_MIRROR_SYNC   ", address(hub.mirrorSync));
        console.log("PULSECHAIN_ORDER_FILLER  ", address(hub.orderFiller));
        console.log("Registrar                ", address(hub.registrar));
        console.log("AnyTokenCheckout         ", address(hub.checkout));
        console.log("UniversalResolver        ", address(hub.core.universalResolver));
        console.log(".hex registry            ", address(hub.core.hexRegistry));
        console.log("Root registry            ", address(hub.core.rootRegistry));
        console.log("Default resolver         ", address(hub.core.ownerResolver));
        console.log("Price oracle             ", address(hub.oracle));
        console.log("Resolver factory         ", address(hub.core.verifiableFactory));
        console.log("Resolver implementation  ", address(hub.core.resolverImplementation));
        console.log("Label store              ", address(hub.core.labelStore));
        console.log("Next: step 2 (Ethereum) with the first two addresses.");
    }
}
