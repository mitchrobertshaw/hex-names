// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IAddrResolver} from "@ens/contracts/resolvers/profiles/IAddrResolver.sol";
import {NameCoder} from "@ens/contracts/utils/NameCoder.sol";

import {AnyTokenCheckout} from "../src/AnyTokenCheckout.sol";
import {IRegistrarLike} from "../src/interfaces/IRegistrarLike.sol";
import {IRentPriceOracle} from "../src/ensv2/registrar/interfaces/IRentPriceOracle.sol";
import {PaymentRatio} from "../src/ensv2/registrar/StandardRentPriceOracle.sol";
import {IRegistry} from "../src/ensv2/registry/interfaces/IRegistry.sol";
import {PermissionedResolver} from "../src/ensv2/resolver/PermissionedResolver.sol";
import {PermissionedResolverLib} from "../src/ensv2/resolver/libraries/PermissionedResolverLib.sol";
import {HexConfig} from "../script/HexConfig.sol";
import {HexDeployment, HexStack} from "../script/HexStack.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockSwapRouter} from "./mocks/MockSwapRouter.sol";
import {MockWPLS} from "./mocks/MockWPLS.sol";

/// @notice The real ENSv2 registry stack, deployed for `.hex` with PulseChain settings: prices,
///         registration, look-ups, renewal, and payment through `AnyTokenCheckout`.
/// @dev Holds ERC-1155 tokens because, as the admin in these tests, it receives the `hex` entry.
contract HexRegistryTest is Test, HexStack, ERC1155Holder {
    uint64 internal constant YEAR = 365 days;

    HexDeployment internal stack;
    MockERC20 internal dai;
    MockERC20 internal usdc;

    // Set by _setUpCheckout.
    MockERC20 internal hexToken;
    MockSwapRouter internal router;
    AnyTokenCheckout internal checkout;

    address internal alice = makeAddr("alice");
    address internal aliceWallet = makeAddr("aliceWallet");
    address internal beneficiary = makeAddr("beneficiary");

    function setUp() public {
        vm.warp(1_800_000_000); // a realistic date, well clear of the premium period for new names

        dai = new MockERC20("Dai Stablecoin from Ethereum", "DAI", 18);
        usdc = new MockERC20("USD Coin from Ethereum", "USDC", 6);
        PaymentRatio[] memory ratios = new PaymentRatio[](2);
        ratios[0] = HexConfig.stablecoinRatio(IERC20(address(dai)), 18);
        ratios[1] = HexConfig.stablecoinRatio(IERC20(address(usdc)), 6);

        stack = _deployHexStack(address(this), beneficiary, ratios);
    }

    // ------------------------------------------------------------------------------------------
    // Prices
    // ------------------------------------------------------------------------------------------

    function test_FiveDollarsAYearInDaiOrUsdc() public view {
        // The oracle charges per second with the rate rounded up, so a year costs a hair over $5.
        uint256 units = HexConfig.baseRates()[4] * YEAR;
        assertGe(units, 5 * HexConfig.PRICE_SCALE, "never under $5");
        assertLt(units, 5 * HexConfig.PRICE_SCALE + HexConfig.PRICE_SCALE / 100_000, "under a thousandth of a cent over");

        (uint256 daiBase, uint256 daiPremium) = stack.registrar.getRegisterPrice("alice", YEAR, IERC20(address(dai)));
        assertEq(daiBase, units * 1e6, "DAI: the base price at 18 decimals");
        assertEq(daiPremium, 0, "no premium for a name that was never registered");

        (uint256 usdcBase,) = stack.registrar.getRegisterPrice("alice", YEAR, IERC20(address(usdc)));
        assertEq(usdcBase, (units + 1e6 - 1) / 1e6, "USDC: the base price rounded up to 6 decimals");

        (uint256 longBase,) = stack.registrar.getRegisterPrice("a-much-longer-name", YEAR, IERC20(address(dai)));
        assertEq(longBase, daiBase, "every name of 5 or more characters costs the same");
    }

    function test_ThreeAndFourCharacterPlaceholderPrices() public view {
        (uint256 three,) = stack.registrar.getRegisterPrice("abc", YEAR, IERC20(address(dai)));
        (uint256 four,) = stack.registrar.getRegisterPrice("abcd", YEAR, IERC20(address(dai)));
        assertApproxEqRel(three, HexConfig.USD_PER_YEAR_3 * 1e18, 1e12, "3 characters");
        assertApproxEqRel(four, HexConfig.USD_PER_YEAR_4 * 1e18, 1e12, "4 characters");
    }

    function test_OneAndTwoCharacterNamesCantBeRegistered() public {
        vm.expectRevert(abi.encodeWithSelector(IRentPriceOracle.NotValid.selector, "ab"));
        stack.registrar.getRegisterPrice("ab", YEAR, IERC20(address(dai)));

        vm.expectRevert(abi.encodeWithSelector(IRentPriceOracle.NotValid.selector, "a"));
        stack.registrar.getRegisterPrice("a", YEAR, IERC20(address(dai)));
    }

    function test_UnsupportedTokenIsRejected() public {
        MockERC20 other = new MockERC20("Other", "OTH", 18);
        vm.expectRevert(abi.encodeWithSelector(IRentPriceOracle.PaymentTokenNotSupported.selector, address(other)));
        stack.registrar.getRegisterPrice("alice", YEAR, IERC20(address(other)));
    }

    // ------------------------------------------------------------------------------------------
    // Registering, looking up and renewing
    // ------------------------------------------------------------------------------------------

    function test_RegisterAndLookUpAliceHex() public {
        PermissionedResolver resolver = _deployResolverFor(alice);
        (uint256 tokenId, uint256 paid) = _registerWithDai("alice", alice, address(resolver));

        assertEq(stack.hexRegistry.ownerOf(tokenId), alice, "alice owns alice.hex");
        assertGe(paid, 5e18, "alice paid $5");
        assertEq(dai.balanceOf(beneficiary), paid, "the fee address received the price");
        assertEq(dai.balanceOf(alice), 0, "alice paid exactly the price");

        bytes32 node = NameCoder.namehash(NameCoder.encode("alice.hex"), 0);
        vm.prank(alice);
        resolver.setAddr(node, aliceWallet);

        assertEq(_lookUp("alice.hex"), aliceWallet, "alice.hex resolves to alice's wallet");
    }

    function test_RenewExtendsByAYearAtFiveDollars() public {
        (uint256 tokenId,) = _registerWithDai("alice", alice, address(0));
        uint64 expiryBefore = stack.hexRegistry.getState(tokenId).expiry;
        uint256 price = stack.registrar.getRenewPrice("alice", YEAR, IERC20(address(dai)));
        assertGe(price, 5e18, "renewal costs $5 a year");

        address friend = makeAddr("friend");
        dai.mint(friend, price);
        vm.startPrank(friend); // anyone can renew
        dai.approve(address(stack.registrar), price);
        stack.registrar.renew("alice", YEAR, IERC20(address(dai)), bytes32(0));
        vm.stopPrank();

        assertEq(
            uint256(stack.hexRegistry.getState(tokenId).expiry), uint256(expiryBefore + YEAR), "a year added"
        );
        assertEq(stack.hexRegistry.ownerOf(tokenId), alice, "renewing doesn't change the owner");
    }

    function test_NameIsTakenOnceRegistered() public {
        _registerWithDai("alice", alice, address(0));
        assertFalse(stack.registrar.isAvailable("alice"), "alice.hex is taken");
        assertTrue(stack.registrar.isAvailable("bobby"), "bobby.hex is still free");
    }

    // ------------------------------------------------------------------------------------------
    // Paying through AnyTokenCheckout
    // ------------------------------------------------------------------------------------------

    function test_CheckoutPaysTheRealRegistrar() public {
        _setUpCheckout();
        address buyer = makeAddr("buyer");
        AnyTokenCheckout.Registration memory reg = _commitFor(buyer, "buyer");
        (uint256 tokenId, uint256 price, uint256 change) = _payWithHex(reg, buyer);

        assertEq(stack.hexRegistry.ownerOf(tokenId), buyer, "buyer owns buyer.hex");
        assertEq(dai.balanceOf(beneficiary), price, "the registrar was paid exactly its price");
        assertEq(dai.balanceOf(buyer), change, "the buyer got the change");
        assertEq(dai.balanceOf(address(checkout)), 0, "nothing left in the checkout");
    }

    // ------------------------------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------------------------------

    function _setUpCheckout() internal {
        hexToken = new MockERC20("HEX", "HEX", 8);
        router = new MockSwapRouter();
        router.setRate(address(hexToken), address(dai), 4e25); // 1 HEX = $0.004
        address[] memory routers = new address[](1);
        routers[0] = address(router);
        checkout = new AnyTokenCheckout(
            IRegistrarLike(address(stack.registrar)), IERC20(address(dai)), IERC20(address(new MockWPLS())), routers
        );
    }

    function _commitFor(address buyer, string memory label)
        internal
        returns (AnyTokenCheckout.Registration memory reg)
    {
        reg = AnyTokenCheckout.Registration({
            label: label,
            owner: buyer,
            secret: keccak256(abi.encode(label, buyer)),
            subregistry: address(0),
            resolver: address(_deployResolverFor(buyer)),
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

    function _payWithHex(AnyTokenCheckout.Registration memory reg, address buyer)
        internal
        returns (uint256 tokenId, uint256 price, uint256 change)
    {
        AnyTokenCheckout.Swap memory swap = AnyTokenCheckout.Swap({
            router: address(router), path: new address[](2), amountOutMin: 0, deadline: vm.getBlockTimestamp() + 1 hours
        });
        swap.path[0] = address(hexToken);
        swap.path[1] = address(dai);
        uint256 quotedIn;
        (price, quotedIn) = checkout.quoteRegister(reg.label, reg.duration, address(router), swap.path);
        swap.amountOutMin = price;
        uint256 amountIn = quotedIn * 102 / 100; // 2% buffer
        hexToken.mint(buyer, amountIn);
        vm.startPrank(buyer);
        hexToken.approve(address(checkout), amountIn);
        (tokenId, change) = checkout.registerWithToken(reg, IERC20(address(hexToken)), amountIn, swap);
        vm.stopPrank();
    }

    function _deployResolverFor(address owner) internal returns (PermissionedResolver) {
        return PermissionedResolver(
            stack.verifiableFactory.deployProxy(
                address(stack.resolverImpl),
                uint256(keccak256(abi.encode(owner))),
                abi.encodeCall(
                    PermissionedResolver.initialize, (owner, PermissionedResolverLib.ROLE_SET_ADDR, new bytes[](0))
                )
            )
        );
    }

    function _registerWithDai(string memory label, address owner, address resolver)
        internal
        returns (uint256 tokenId, uint256 paid)
    {
        bytes32 secret = keccak256(bytes(label));
        stack.registrar.commit(
            stack.registrar.makeCommitment(label, owner, secret, IRegistry(address(0)), resolver, YEAR, bytes32(0))
        );
        vm.warp(vm.getBlockTimestamp() + HexConfig.MIN_COMMITMENT_AGE);

        (uint256 base, uint256 premium) = stack.registrar.getRegisterPrice(label, YEAR, IERC20(address(dai)));
        paid = base + premium;
        dai.mint(owner, paid);
        vm.startPrank(owner);
        dai.approve(address(stack.registrar), paid);
        tokenId = stack.registrar.register(
            label, owner, secret, IRegistry(address(0)), resolver, YEAR, IERC20(address(dai)), bytes32(0)
        );
        vm.stopPrank();
    }

    function _lookUp(string memory name) internal view returns (address) {
        bytes32 node = NameCoder.namehash(NameCoder.encode(name), 0);
        (bytes memory result,) =
            stack.universalResolver.resolve(NameCoder.encode(name), abi.encodeCall(IAddrResolver.addr, (node)));
        return abi.decode(result, (address));
    }
}
