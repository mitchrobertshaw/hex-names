// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {PaymentRatio, DiscountPoint} from "../src/ensv2/registrar/StandardRentPriceOracle.sol";

/// @notice Settings for the `.hex` registry: the ending, prices, and registration rules.
/// @dev Prices are in the rent price oracle's base units, where one US dollar is `PRICE_SCALE`.
///      The oracle charges per second, so each yearly price is turned into a per-second rate,
///      rounded up so a full year never costs less than the yearly price.
library HexConfig {
    /// @notice The ending every name is registered under.
    string internal constant ENDING = "hex";

    uint64 internal constant SEC_PER_YEAR = 365 days;

    /// @notice One US dollar in the oracle's base units is 10^PRICE_DECIMALS.
    uint8 internal constant PRICE_DECIMALS = 12;
    uint256 internal constant PRICE_SCALE = 10 ** PRICE_DECIMALS;

    /// @notice Yearly price in US dollars for names of 5 or more characters.
    uint256 internal constant USD_PER_YEAR_5_PLUS = 5;
    /// @notice Yearly price for 4-character names. Placeholder copied from ENS; not decided yet.
    uint256 internal constant USD_PER_YEAR_4 = 160;
    /// @notice Yearly price for 3-character names. Placeholder copied from ENS; not decided yet.
    uint256 internal constant USD_PER_YEAR_3 = 640;
    // Names of 1 or 2 characters have no price, so they can't be registered.

    /// @notice A commitment must be at least this old before the name can be registered.
    uint64 internal constant MIN_COMMITMENT_AGE = 60;
    /// @notice A commitment older than this can no longer be used.
    uint64 internal constant MAX_COMMITMENT_AGE = 1 days;
    /// @notice The shortest registration allowed.
    uint64 internal constant MIN_REGISTER_DURATION = 28 days;
    /// @notice How long after expiry the owner can still renew before the name is released.
    uint64 internal constant GRACE_PERIOD = 28 days;

    /// @notice Recently released names cost extra: this much at first, halving every
    ///         `PREMIUM_HALVING_PERIOD`, and nothing after `PREMIUM_PERIOD`. Same as ENS.
    uint256 internal constant PREMIUM_PRICE_INITIAL = 100_000_000 * PRICE_SCALE;
    uint64 internal constant PREMIUM_HALVING_PERIOD = 1 days;
    uint64 internal constant PREMIUM_PERIOD = 21 days;

    /// @notice Scale for multi-year discounts. No discounts are set, so a year always costs the same.
    uint128 internal constant DISCOUNT_DENOMINATOR = 1e38;

    /// @notice Per-second base rates, indexed by character count minus one. The last entry
    ///         prices every longer name too.
    function baseRates() internal pure returns (uint256[] memory rates) {
        rates = new uint256[](5);
        rates[0] = 0; // 1 character: not available
        rates[1] = 0; // 2 characters: not available
        rates[2] = _perSecond(USD_PER_YEAR_3);
        rates[3] = _perSecond(USD_PER_YEAR_4);
        rates[4] = _perSecond(USD_PER_YEAR_5_PLUS);
    }

    /// @notice No multi-year discounts.
    function discountPoints() internal pure returns (DiscountPoint[] memory points) {
        points = new DiscountPoint[](0);
    }

    /// @notice Exchange rate for a dollar stablecoin with `decimals` decimals, at one dollar each.
    function stablecoinRatio(IERC20 token, uint8 decimals) internal pure returns (PaymentRatio memory) {
        if (decimals >= PRICE_DECIMALS) {
            return PaymentRatio(token, uint128(10) ** (decimals - PRICE_DECIMALS), 1);
        }
        return PaymentRatio(token, 1, uint128(10) ** (PRICE_DECIMALS - decimals));
    }

    function _perSecond(uint256 usdPerYear) private pure returns (uint256) {
        return (usdPerYear * PRICE_SCALE + SEC_PER_YEAR - 1) / SEC_PER_YEAR;
    }
}
