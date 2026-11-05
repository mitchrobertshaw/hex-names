// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IAddrResolver} from "@ens/contracts/resolvers/profiles/IAddrResolver.sol";
import {NameCoder} from "@ens/contracts/utils/NameCoder.sol";

import {AnyTokenCheckout} from "../../src/AnyTokenCheckout.sol";
import {IRegistrarLike} from "../../src/interfaces/IRegistrarLike.sol";
import {ISwapRouterLike} from "../../src/interfaces/ISwapRouterLike.sol";
import {PaymentRatio} from "../../src/ensv2/registrar/StandardRentPriceOracle.sol";
import {IRegistry} from "../../src/ensv2/registry/interfaces/IRegistry.sol";
import {PermissionedResolver} from "../../src/ensv2/resolver/PermissionedResolver.sol";
import {PermissionedResolverLib} from "../../src/ensv2/resolver/libraries/PermissionedResolverLib.sol";
import {HexConfig} from "../../script/HexConfig.sol";
import {HexDeployment, HexStack} from "../../script/HexStack.sol";

/// @notice The PulseX router function used to buy USDC with PLS for the direct-payment test.
interface IPulseXRouterBuy {
    function swapETHForExactTokens(uint256 amountOut, address[] calldata path, address to, uint256 deadline)
        external
        payable
        returns (uint256[] memory amounts);
}

/// @notice The whole `.hex` registry on a live copy of PulseChain: deployed with the real bridged
///         DAI and USDC, paid for in PLS through the real PulseX pools, and looked up afterwards.
/// @dev Set PULSECHAIN_RPC_URL to use your own node; it defaults to the public RPC.
contract HexRegistryForkTest is Test, HexStack, ERC1155Holder {
    // Addresses checked on-chain on 2026-11-05.
    address internal constant WPLS = 0xA1077a294dDE1B09bB078844df40758a5D0f9a27;
    address internal constant DAI = 0xefD766cCb38EaF1dfd701853BFCe31359239F305; // Dai Stablecoin from Ethereum
    address internal constant USDC = 0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07; // USD Coin from Ethereum
    address internal constant PULSEX_V1_ROUTER = 0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02;
    address internal constant PULSEX_V2_ROUTER = 0x165C3410fC91EF562C50559f7d2289fEbed552d9;

    uint64 internal constant YEAR = 365 days;

    HexDeployment internal stack;
    AnyTokenCheckout internal checkout;
    address internal beneficiary = makeAddr("beneficiary");

    function setUp() public {
        vm.createSelectFork(vm.envOr("PULSECHAIN_RPC_URL", string("https://rpc.pulsechain.com")));
        // The public RPC is a group of nodes that can briefly disagree about the newest block.
        // Step back a few blocks to one they have all settled on.
        vm.rollFork(block.number - 16);

        PaymentRatio[] memory ratios = new PaymentRatio[](2);
        ratios[0] = HexConfig.stablecoinRatio(IERC20(DAI), 18);
        ratios[1] = HexConfig.stablecoinRatio(IERC20(USDC), 6);
        stack = _deployHexStack(address(this), beneficiary, ratios);

        address[] memory routers = new address[](2);
        routers[0] = PULSEX_V1_ROUTER;
        routers[1] = PULSEX_V2_ROUTER;
        checkout =
            new AnyTokenCheckout(IRegistrarLike(address(stack.registrar)), IERC20(DAI), IERC20(WPLS), routers);
    }

    function test_Fork_BuyWithPlsThenLookUp() public {
        address buyer = makeAddr("buyer");
        AnyTokenCheckout.Registration memory reg = _commitFor(buyer, "pulsechain");

        address[] memory path = new address[](2);
        path[0] = WPLS;
        path[1] = DAI;
        (address router, uint256 plsNeeded) = _cheapestRouter(path, _registerPrice(reg.label, IERC20(DAI)));
        uint256 value = plsNeeded * 101 / 100;
        vm.deal(buyer, value);

        (uint256 price, uint256 tokenId, uint256 change) = _payWithPls(reg, buyer, router, path, value);

        assertEq(stack.hexRegistry.ownerOf(tokenId), buyer, "buyer owns pulsechain.hex");
        assertGe(price, 5e18, "the registrar charged $5");
        assertEq(IERC20(DAI).balanceOf(beneficiary), price, "the fee address received $5 in bridged DAI");
        assertEq(IERC20(DAI).balanceOf(buyer), change, "the buyer got the change in bridged DAI");
        assertEq(IERC20(DAI).balanceOf(address(checkout)), 0, "nothing left in the checkout");

        _setAddr(buyer, reg.resolver, "pulsechain.hex", buyer);
        assertEq(_lookUp("pulsechain.hex"), buyer, "pulsechain.hex resolves to the buyer");
    }

    function test_Fork_PayDirectlyInBridgedUsdc() public {
        address buyer = makeAddr("usdcBuyer");
        AnyTokenCheckout.Registration memory reg = _commitFor(buyer, "stablecoin");
        uint256 price = _registerPrice(reg.label, IERC20(USDC));
        _buyWithPls(USDC, price, buyer);

        vm.startPrank(buyer);
        IERC20(USDC).approve(address(stack.registrar), price);
        uint256 tokenId = stack.registrar.register(
            reg.label, reg.owner, reg.secret, IRegistry(reg.subregistry), reg.resolver, reg.duration, IERC20(USDC), reg.referrer
        );
        vm.stopPrank();

        assertEq(stack.hexRegistry.ownerOf(tokenId), buyer, "buyer owns stablecoin.hex");
        assertEq(IERC20(USDC).balanceOf(beneficiary), price, "the fee address received $5 in bridged USDC");
        assertGe(price, 5e6, "$5 in USDC");
    }

    // ------------------------------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------------------------------

    function _commitFor(address buyer, string memory label)
        internal
        returns (AnyTokenCheckout.Registration memory reg)
    {
        PermissionedResolver resolver = PermissionedResolver(
            stack.verifiableFactory.deployProxy(
                address(stack.resolverImpl),
                uint256(keccak256(abi.encode(buyer))),
                abi.encodeCall(
                    PermissionedResolver.initialize, (buyer, PermissionedResolverLib.ROLE_SET_ADDR, new bytes[](0))
                )
            )
        );
        reg = AnyTokenCheckout.Registration({
            label: label,
            owner: buyer,
            secret: keccak256(abi.encode(label, buyer)),
            subregistry: address(0),
            resolver: address(resolver),
            duration: YEAR,
            referrer: bytes32(0)
        });
        stack.registrar.commit(
            stack.registrar.makeCommitment(
                reg.label, reg.owner, reg.secret, IRegistry(reg.subregistry), reg.resolver, reg.duration, reg.referrer
            )
        );
        vm.warp(vm.getBlockTimestamp() + HexConfig.MIN_COMMITMENT_AGE);
    }

    function _payWithPls(
        AnyTokenCheckout.Registration memory reg,
        address buyer,
        address router,
        address[] memory path,
        uint256 value
    ) internal returns (uint256 price, uint256 tokenId, uint256 change) {
        price = _registerPrice(reg.label, IERC20(DAI));
        AnyTokenCheckout.Swap memory swap = AnyTokenCheckout.Swap({
            router: router, path: path, amountOutMin: price, deadline: vm.getBlockTimestamp() + 1 hours
        });
        vm.prank(buyer);
        (tokenId, change) = checkout.registerWithPLS{value: value}(reg, swap);
    }

    function _registerPrice(string memory label, IERC20 token) internal view returns (uint256) {
        (uint256 base, uint256 premium) = stack.registrar.getRegisterPrice(label, YEAR, token);
        return base + premium;
    }

    function _setAddr(address owner, address resolver, string memory name, address wallet) internal {
        vm.prank(owner);
        PermissionedResolver(resolver).setAddr(NameCoder.namehash(NameCoder.encode(name), 0), wallet);
    }

    function _lookUp(string memory name) internal view returns (address) {
        bytes32 node = NameCoder.namehash(NameCoder.encode(name), 0);
        (bytes memory result,) =
            stack.universalResolver.resolve(NameCoder.encode(name), abi.encodeCall(IAddrResolver.addr, (node)));
        return abi.decode(result, (address));
    }

    /// @dev Buys exactly `amountOut` of `token` for `to` with PLS, so the balance comes from the token's own code.
    function _buyWithPls(address token, uint256 amountOut, address to) internal {
        address[] memory path = new address[](2);
        path[0] = WPLS;
        path[1] = token;
        (address router, uint256 plsIn) = _cheapestRouter(path, amountOut);
        plsIn = plsIn * 101 / 100; // the router refunds whatever isn't needed
        vm.deal(to, plsIn);
        vm.prank(to);
        IPulseXRouterBuy(router).swapETHForExactTokens{value: plsIn}(
            amountOut, path, to, vm.getBlockTimestamp() + 1 hours
        );
    }

    /// @dev The PulseX router that sells `amountOut` of the last token in `path` for the least input.
    function _cheapestRouter(address[] memory path, uint256 amountOut)
        internal
        view
        returns (address best, uint256 bestIn)
    {
        address[2] memory routers = [PULSEX_V1_ROUTER, PULSEX_V2_ROUTER];
        bestIn = type(uint256).max;
        for (uint256 i = 0; i < routers.length; ++i) {
            try ISwapRouterLike(routers[i]).getAmountsIn(amountOut, path) returns (uint256[] memory amounts) {
                if (amounts[0] != 0 && amounts[0] < bestIn) {
                    bestIn = amounts[0];
                    best = routers[i];
                }
            } catch {}
        }
        require(best != address(0), "no PulseX pool for this path");
    }
}
