// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IRentPriceOracle} from "@ensv2/registrar/interfaces/IRentPriceOracle.sol";

/// @title HexNameLengthCap
/// @notice Sits between the .hex registrar and its price oracle, and caps new names at 63 bytes: the
///         most one part of a web address can hold, so every .hex name can also work as one. A
///         longer name can't be priced, so it can't be registered: it fails with the oracle's own
///         `NotValid`, as a name that's too short does. Renewals pass straight through, so nobody
///         is ever kept from renewing a name they have. Prices are the oracle's, and the admin still
///         manages them there.
contract HexNameLengthCap is IRentPriceOracle, IERC165 {
    /// @notice The longest name that can be registered, in bytes. Letters, digits and hyphens are
    ///         one byte each; other characters take two to four.
    uint256 public constant MAX_LENGTH = 63;

    /// @notice The oracle that prices every name.
    IRentPriceOracle public immutable ORACLE;

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
        return ORACLE.getRegisterPrice(label, available, duration, paymentToken);
    }

    /// @inheritdoc IRentPriceOracle
    function getRenewPrice(string calldata label, uint64 expiry, uint64 duration, IERC20 paymentToken)
        external
        view
        returns (uint256)
    {
        return ORACLE.getRenewPrice(label, expiry, duration, paymentToken);
    }

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IRentPriceOracle).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
