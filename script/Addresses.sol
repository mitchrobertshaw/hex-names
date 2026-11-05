// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Live addresses the deployment uses. All checked on-chain on 2026-11-05.
library PulseChainAddresses {
    /// @dev The official PulseChain bridge's message contract, home side (5 of 8 validators).
    address internal constant AMB = 0x6ef79FD6f9f840264332884240539Ed7A2dA8b2b;
    /// @dev USDC bridged from Ethereum (6 decimals). The checkout's payment token.
    address internal constant USDC = 0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07;
    /// @dev DAI bridged from Ethereum (18 decimals). Also accepted by the registrar.
    address internal constant DAI = 0xefD766cCb38EaF1dfd701853BFCe31359239F305;
    address internal constant WPLS = 0xA1077a294dDE1B09bB078844df40758a5D0f9a27;
    /// @dev HEX on PulseChain (8 decimals), the same address as on Ethereum.
    address internal constant HEX = 0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39;
    address internal constant PULSEX_V1_ROUTER = 0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02;
    address internal constant PULSEX_V2_ROUTER = 0x165C3410fC91EF562C50559f7d2289fEbed552d9;
}

library EthereumAddresses {
    /// @dev The official PulseChain bridge's message contract, foreign side (same 8 validators).
    address internal constant AMB = 0xd0764FAe29E0a6a96fF685f71CfC685456D5636c;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant HEX = 0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39;
    address internal constant UNISWAP_V2_ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
}
