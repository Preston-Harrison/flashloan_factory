// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "../interfaces/IFlashloanFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PoolCreator is Ownable {
    address public immutable factory;

    uint256 public oneTimeMintFee;
    uint256 public multiMintFee;

    event ChangeFees(uint256 oneTimeMintFee, uint256 multiMintFee);

    modifier requireValue(uint256 value) {
        require(msg.value == value, "PoolCreator: Invalid msg.value");
        _;
    }

    constructor(address _factory, uint256 _oneTimeMintFee, uint256 _multiMintFee) {
        factory = _factory;

        oneTimeMintFee = _oneTimeMintFee;
        multiMintFee = _multiMintFee;
        emit ChangeFees(_oneTimeMintFee, _multiMintFee);
    }

    function setFees(uint256 _oneTimeMintFee, uint256 _multiMintFee) external onlyOwner {
        oneTimeMintFee = _oneTimeMintFee;
        multiMintFee = _multiMintFee;
        emit ChangeFees(_oneTimeMintFee, _multiMintFee);
    }

    function createPool(address token) external payable requireValue(oneTimeMintFee) returns (address pool) {
        return _createPool(token);
    }

    function _createPool(address token) internal returns (address pool) {
        return IFlashloanFactory(factory).createPool(token);
    }

    function createPools(address[] calldata tokens) external payable requireValue(tokens.length * multiMintFee) returns (address[] memory pools) {
        pools = new address[](tokens.length);
        uint256 length = tokens.length;
        for (uint256 i = 0; i < length; i++) {
            pools[i] = _createPool(tokens[i]);
        }
    }
}