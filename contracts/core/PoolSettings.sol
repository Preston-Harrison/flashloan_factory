// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

/// @dev 1 ethers is 100%, for all fees in PoolSettings
contract PoolSettings {
    constructor() {
        // make sure fees actually add up
        require(PROVIDER_FEE + OWNER_FEE + DEVELOPER_FEE == 1 ether, "PoolSettings: Fee total not 100%");
    }
    /// @dev the maximum fee for flashloans
    uint256 public constant MAX_FEE = 1 ether * 0.005; // 0.5%
    /// @dev the minimum fee for flashloans
    uint256 public constant MIN_FEE = 1 ether * 0.0005; // 0.05%
    /// @dev the minimum fee to not loose significant fees to rounding errors
    uint256 public constant MIN_FEE_AMOUNT = 10;

    /// @dev the fee fraction that goes to the liquidity providers
    uint256 public constant PROVIDER_FEE = 1 ether * 0.7; // 70%
    /// @dev the fee fraction that goes to the liquidity providers
    uint256 public constant OWNER_FEE = 1 ether * 0.2; // 20%
    /// @dev the fee fraction that goes to the liquidity providers
    uint256 public constant DEVELOPER_FEE = 1 ether * 0.1; // 10%
}