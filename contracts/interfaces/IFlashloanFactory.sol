// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

abstract contract IFlashloanFactory {
    event CreatePool(
        address indexed token,
        address indexed pool,
        uint256 fee
    );

    /// @dev the address of the owner ERC721 token
    function OWNER_TOKEN() external view virtual returns (address);
    /// @dev the address of the developer fee receiver
    function getDeveloper() external view virtual returns (address);
    /// @dev the ETH cost to create a pool
    function mintFee() external view virtual returns (uint256);

    /// @dev creates a pool for {token}
    /// @param token the token for the pool that will be created
    /// @return pool the address of the new pool
    function createPool(address token) external payable virtual returns (address pool);

    /// @dev initiates a transaction for {token}. Sets the initiator of the 
    /// flashloan to the caller of this function, as opposed to this contract
    /// see {IFlashloan-initiateTransactionWithInitiator}
    function initiateTransaction(
        address token, 
        uint256 amount, 
        address callTarget, 
        address fundsTarget, 
        bytes memory params
    ) external virtual;
}