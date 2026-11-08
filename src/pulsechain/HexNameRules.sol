// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IRentPriceOracle} from "@ensv2/registrar/interfaces/IRentPriceOracle.sol";

/// @title HexNameRules
/// @notice Sits between the .hex registrar and its price oracle, and keeps two rules:
///         - New names are at most 63 bytes: the most one part of a web address can hold, so every
///           .hex name can also work as one. A longer name can't be priced, so it can't be
///           registered: it fails with the oracle's own `NotValid`, as a name that's too short does.
///         - A name is paid for at most 5 years ahead: a registration is at most 5 years, and a
///           renewal can't take the expiry more than 5 years past today. An owner can always renew
///           back up to 5 years ahead, so nobody is ever kept from keeping their name.
///         Prices are the oracle's, and the admin still manages them there.
contract HexNameRules is IRentPriceOracle, IERC165 {
    /// @notice The longest name that can be registered, in bytes. Letters, digits and hyphens are
    ///         one byte each; other characters take two to four.
    uint256 public constant MAX_LENGTH = 63;

    /// @notice How far ahead a name can be paid for: 5 years of 365 days, as the oracle counts them.
    uint64 public constant MAX_TERM = 5 * 365 days;

    /// @notice The oracle that prices every name.
    IRentPriceOracle public immutable ORACLE;

    /// @notice A registration or renewal would take `label`'s expiry to `newExpiry`, past `latest`.
    error TooFarAhead(string label, uint256 newExpiry, uint256 latest);

    constructor(IRentPriceOracle oracle) {
        ORACLE = oracle;
    }

    /// @inheritdoc IRentPriceOracle
    function getRegisterPrice(string calldata label, uint64 available, uint64 duration, IERC20 paymentToken)
        external
        view
        returns (uint256 base, uint256 premium)
    {
        if (bytes(label).length > MAX_LENGTH) revert NotValid(label);
        if (duration > MAX_TERM) {
            revert TooFarAhead(label, block.timestamp + duration, block.timestamp + MAX_TERM);
        }
        return ORACLE.getRegisterPrice(label, available, duration, paymentToken);
    }

    /// @inheritdoc IRentPriceOracle
    function getRenewPrice(string calldata label, uint64 expiry, uint64 duration, IERC20 paymentToken)
        external
        view
        returns (uint256)
    {
        uint256 newExpiry = uint256(expiry) + duration;
        if (newExpiry > block.timestamp + MAX_TERM) revert TooFarAhead(label, newExpiry, block.timestamp + MAX_TERM);
        return ORACLE.getRenewPrice(label, expiry, duration, paymentToken);
    }

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IRentPriceOracle).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
