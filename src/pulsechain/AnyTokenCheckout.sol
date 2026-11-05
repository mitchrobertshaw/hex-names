// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IETHRegistrar} from "@ensv2/registrar/interfaces/IETHRegistrar.sol";
import {IRegistry} from "@ensv2/registry/interfaces/IRegistry.sol";

import {ZeroAddress} from "../common/Errors.sol";
import {SwapPayments} from "../common/SwapPayments.sol";
import {IHexMirrorSync} from "../interfaces/IHexBridge.sol";

/// @title AnyTokenCheckout
/// @notice Buy or renew a .hex name on PulseChain with any token, or with PLS, while the registrar
///         is only ever paid in its own dollar stablecoin.
/// @dev The same design as the .pdai checkout. The input is swapped into `PAYMENT_TOKEN` on PulseX,
///      the registrar is paid exactly its price, and whatever is left goes back to the caller.
///
///      Registration keeps the registrar's protection against front-running:
///        1. The buyer calls `commit(makeCommitment(...))` on the registrar directly.
///        2. After the registrar's minimum commitment age, the buyer calls `registerWithToken` or
///           `registerWithPLS` here with the same details. ENSv2's commitment does not include the
///           caller, so this contract can complete it for the buyer.
///
///      After a registration or renewal, the name is sent to the Ethereum copy through
///      `MIRROR_SYNC` (best effort; it never blocks a purchase).
///
///      No owner, no admin functions, no upgrades. Holds nothing between calls.
contract AnyTokenCheckout is SwapPayments, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice A registration, with the same details that were committed on the registrar.
    struct Registration {
        string label; // the name without .hex, e.g. "alice" for alice.hex
        address owner; // who receives the name
        bytes32 secret; // the secret used in the commitment
        IRegistry subregistry; // ENSv2 subregistry for the name, or zero
        address resolver; // resolver for the name, or zero to resolve to the owner
        uint64 duration; // seconds
        bytes32 referrer; // referral tag, passed through to the registrar
    }

    /// @notice A renewal.
    struct Renewal {
        string label;
        uint64 duration; // seconds to add
        bytes32 referrer;
    }

    /// @notice The .hex registrar.
    IETHRegistrar public immutable REGISTRAR;

    /// @notice Copies names to Ethereum after a purchase, or zero to skip that.
    IHexMirrorSync public immutable MIRROR_SYNC;

    /// @notice A registration or renewal was paid for through this contract.
    /// @param payer Who called and received the change.
    /// @param tokenIn The token paid with, or zero for native PLS.
    /// @param amountIn How much of `tokenIn` the payer sent.
    /// @param price What the registrar was paid, in `PAYMENT_TOKEN`.
    /// @param change What was returned to the payer, in `PAYMENT_TOKEN`.
    /// @param renewal True for a renewal, false for a new registration.
    event Paid(
        address indexed payer, address indexed tokenIn, uint256 amountIn, uint256 price, uint256 change, bool renewal
    );

    /// @param registrar The .hex registrar.
    /// @param paymentToken A stablecoin the registrar accepts, e.g. USDC bridged from Ethereum.
    /// @param wpls Wrapped PLS.
    /// @param routers Uniswap-V2-style routers to allow, e.g. PulseX V1 and V2. Fixed for good.
    /// @param mirrorSync `HexMirrorSync`, or zero.
    constructor(
        IETHRegistrar registrar,
        IERC20 paymentToken,
        IERC20 wpls,
        address[] memory routers,
        IHexMirrorSync mirrorSync
    ) SwapPayments(paymentToken, wpls, routers) {
        if (address(registrar) == address(0)) revert ZeroAddress();
        REGISTRAR = registrar;
        MIRROR_SYNC = mirrorSync;
    }

    // ------------------------------------------------------------------------------------------
    // Registration
    // ------------------------------------------------------------------------------------------

    /// @notice Registers a name, paying with `amountIn` of `tokenIn`.
    /// @dev The caller must have approved this contract for `amountIn` of `tokenIn`, and must have
    ///      committed `reg` on the registrar beforehand. Quote with `quoteRegister`, then add a
    ///      buffer for price movement and for any transfer tax the token charges.
    /// @return tokenId The registrar's token id for the name.
    /// @return change `PAYMENT_TOKEN` returned to the caller.
    function registerWithToken(Registration calldata reg, IERC20 tokenIn, uint256 amountIn, Swap calldata swap)
        external
        nonReentrant
        returns (uint256 tokenId, uint256 change)
    {
        _validateRoute(address(tokenIn), swap.router, swap.path);
        uint256 got = _toPaymentToken(tokenIn, _pull(tokenIn, amountIn), swap);
        uint256 paid;
        (tokenId, paid, change) = _payRegistration(reg, got);
        emit Paid(msg.sender, address(tokenIn), amountIn, paid, change, false);
    }

    /// @notice Registers a name, paying with the PLS sent along with the call.
    /// @dev `swap.path` must start with WPLS. Change comes back in `PAYMENT_TOKEN`, not PLS.
    function registerWithPLS(Registration calldata reg, Swap calldata swap)
        external
        payable
        nonReentrant
        returns (uint256 tokenId, uint256 change)
    {
        _validateRoute(address(WRAPPED_NATIVE), swap.router, swap.path);
        uint256 got = _toPaymentToken(WRAPPED_NATIVE, _wrap(), swap);
        uint256 paid;
        (tokenId, paid, change) = _payRegistration(reg, got);
        emit Paid(msg.sender, address(0), msg.value, paid, change, false);
    }

    // ------------------------------------------------------------------------------------------
    // Renewal
    // ------------------------------------------------------------------------------------------

    /// @notice Renews a name, paying with `amountIn` of `tokenIn`. Anyone can renew any name.
    /// @return change `PAYMENT_TOKEN` returned to the caller.
    function renewWithToken(Renewal calldata ren, IERC20 tokenIn, uint256 amountIn, Swap calldata swap)
        external
        nonReentrant
        returns (uint256 change)
    {
        _validateRoute(address(tokenIn), swap.router, swap.path);
        uint256 got = _toPaymentToken(tokenIn, _pull(tokenIn, amountIn), swap);
        uint256 paid;
        (paid, change) = _payRenewal(ren, got);
        emit Paid(msg.sender, address(tokenIn), amountIn, paid, change, true);
    }

    /// @notice Renews a name, paying with the PLS sent along with the call.
    function renewWithPLS(Renewal calldata ren, Swap calldata swap)
        external
        payable
        nonReentrant
        returns (uint256 change)
    {
        _validateRoute(address(WRAPPED_NATIVE), swap.router, swap.path);
        uint256 got = _toPaymentToken(WRAPPED_NATIVE, _wrap(), swap);
        uint256 paid;
        (paid, change) = _payRenewal(ren, got);
        emit Paid(msg.sender, address(0), msg.value, paid, change, true);
    }

    // ------------------------------------------------------------------------------------------
    // Quotes, for websites
    // ------------------------------------------------------------------------------------------

    /// @notice The registrar's price for a registration, and roughly how much of `path[0]` buys it.
    /// @dev `amountIn` ignores transfer taxes and price movement; add a buffer before paying.
    ///      With an empty `path`, `amountIn` is the price in `PAYMENT_TOKEN` itself.
    function quoteRegister(string calldata label, uint64 duration, address router, address[] calldata path)
        external
        view
        returns (uint256 price, uint256 amountIn)
    {
        price = _registerPrice(label, duration);
        amountIn = _quoteIn(price, router, path);
    }

    /// @notice The registrar's price for a renewal, and roughly how much of `path[0]` buys it.
    function quoteRenew(string calldata label, uint64 duration, address router, address[] calldata path)
        external
        view
        returns (uint256 price, uint256 amountIn)
    {
        price = REGISTRAR.getRenewPrice(label, duration, PAYMENT_TOKEN);
        amountIn = _quoteIn(price, router, path);
    }

    // ------------------------------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------------------------------

    /// @dev Pays the registrar for `reg` out of `got` and returns the rest to the caller.
    function _payRegistration(Registration calldata reg, uint256 got)
        private
        returns (uint256 tokenId, uint256 paid, uint256 change)
    {
        uint256 price = _registerPrice(reg.label, reg.duration);
        if (got < price) revert InsufficientPayment(got, price);
        uint256 before = PAYMENT_TOKEN.balanceOf(address(this));
        PAYMENT_TOKEN.forceApprove(address(REGISTRAR), price);
        tokenId = _callRegister(reg);
        PAYMENT_TOKEN.forceApprove(address(REGISTRAR), 0);
        paid = before - PAYMENT_TOKEN.balanceOf(address(this));
        change = _refund(got - paid);
        _trySync(reg.label);
    }

    function _callRegister(Registration calldata reg) private returns (uint256) {
        return REGISTRAR.register(
            reg.label, reg.owner, reg.secret, reg.subregistry, reg.resolver, reg.duration, PAYMENT_TOKEN, reg.referrer
        );
    }

    /// @dev Pays the registrar for `ren` out of `got` and returns the rest to the caller.
    function _payRenewal(Renewal calldata ren, uint256 got) private returns (uint256 paid, uint256 change) {
        uint256 price = REGISTRAR.getRenewPrice(ren.label, ren.duration, PAYMENT_TOKEN);
        if (got < price) revert InsufficientPayment(got, price);
        uint256 before = PAYMENT_TOKEN.balanceOf(address(this));
        PAYMENT_TOKEN.forceApprove(address(REGISTRAR), price);
        REGISTRAR.renew(ren.label, ren.duration, PAYMENT_TOKEN, ren.referrer);
        PAYMENT_TOKEN.forceApprove(address(REGISTRAR), 0);
        paid = before - PAYMENT_TOKEN.balanceOf(address(this));
        change = _refund(got - paid);
        _trySync(ren.label);
    }

    function _registerPrice(string calldata label, uint64 duration) private view returns (uint256) {
        (uint256 base, uint256 premium) = REGISTRAR.getRegisterPrice(label, duration, PAYMENT_TOKEN);
        return base + premium;
    }

    /// @dev Copies the name to Ethereum. Best effort: a failure here never blocks a purchase.
    function _trySync(string calldata label) private {
        if (address(MIRROR_SYNC) == address(0)) return;
        try MIRROR_SYNC.sync(label) {} catch {}
    }
}
