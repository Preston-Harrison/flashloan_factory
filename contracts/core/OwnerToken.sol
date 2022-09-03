// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFlashloanPool.sol";
import "../interfaces/IOwnerToken.sol";

contract OwnerToken is IOwnerToken {
    constructor() IOwnerToken("Flashloan Owner", "FLASH") {}

    function mint(address to, address pool) external override onlyOwner {
        _mint(to, uint256(uint160(pool)));
    }

    function _beforeTokenTransfer(address from, address /* to */, uint256 tokenId) internal override {
        address flashloanPool = address(uint160(tokenId));
        if (from != address(0)) { // don't call ownerWithdraw on mint, as the pool does not exist
            IFlashloanPool(flashloanPool).ownerWithdraw();
        }
    }
}