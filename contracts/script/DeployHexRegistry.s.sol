// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {PaymentRatio} from "../src/ensv2/registrar/StandardRentPriceOracle.sol";
import {HexConfig} from "./HexConfig.sol";
import {HexDeployment, HexStack} from "./HexStack.sol";

/// @notice Deploys the `.hex` registry stack on PulseChain mainnet.
/// @dev Environment variables:
///        BENEFICIARY           required. Receives registration and renewal payments. Use a multisig.
///        DEPLOYER_PRIVATE_KEY  optional. Without it, run without --broadcast for a dry run.
///      The deploying account keeps the setup roles. Until the step that hands them to a multisig
///      exists, use this for dry runs only.
contract DeployHexRegistry is Script, HexStack {
    // Checked on-chain on 2026-11-05.
    address internal constant DAI_FROM_ETHEREUM = 0xefD766cCb38EaF1dfd701853BFCe31359239F305;
    address internal constant USDC_FROM_ETHEREUM = 0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07;

    function run() external returns (HexDeployment memory d) {
        require(block.chainid == 369, "not PulseChain mainnet (chain id 369)");
        address beneficiary = vm.envAddress("BENEFICIARY");

        PaymentRatio[] memory ratios = new PaymentRatio[](2);
        ratios[0] = HexConfig.stablecoinRatio(IERC20(DAI_FROM_ETHEREUM), 18);
        ratios[1] = HexConfig.stablecoinRatio(IERC20(USDC_FROM_ETHEREUM), 6);

        uint256 key = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        address admin;
        if (key != 0) {
            admin = vm.addr(key);
            vm.startBroadcast(key);
        } else {
            admin = msg.sender;
            vm.startBroadcast();
        }
        d = _deployHexStack(admin, beneficiary, ratios);
        vm.stopBroadcast();

        console.log("Root registry:", address(d.rootRegistry));
        console.log(".hex registry:", address(d.hexRegistry));
        console.log("Registrar:", address(d.registrar));
        console.log("Rent price oracle:", address(d.rentPriceOracle));
        console.log("Universal resolver:", address(d.universalResolver));
        console.log("Resolver template:", address(d.resolverImpl));
        console.log("Verifiable factory:", address(d.verifiableFactory));
        console.log("Setup roles held by:", admin);
    }
}
