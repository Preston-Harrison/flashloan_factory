// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

abstract contract IFlashloanFactory {
    event CreatePool(
        address indexed creator,
        address indexed token,
        address pool
    );

    event ChangeDeveloper(address developer);

    /// @dev the address of the owner ERC721 token
    function OWNER_TOKEN() external view virtual returns (address);
    /// @dev gets the address of the developer fee receiver
    function getDeveloper() external view virtual returns (address);
    /// @dev sets the address of the developer fee receiver
    function setDeveloper(address _developer) external virtual;

    /// @dev creates a pool for {token}
    /// @param token the token for the pool that will be created
    /// @return pool the address of the new pool
    function createPool(address token) external virtual returns (address pool);

    /// @dev initiates a transaction for {token}. Sets the initiator of the 
    /// flashloan to the caller of this function, as opposed to this contract
    /// see {IFlashloan-initiateTransactionWithInitiator}
    function initiateTransaction(
        address token, 
        uint256 amount, 
        address target, 
        bytes memory params
    ) external virtual;
}