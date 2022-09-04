// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract IOwnerToken is ERC721, Ownable {
    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    /// @dev mints an owner token to {to} for pool at address {pool}
    /// @param to the address to mint the token to
    /// @param pool the pool for which the token dictates ownership
    function mint(address to, address pool) external virtual;
}