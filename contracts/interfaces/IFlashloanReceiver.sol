// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

abstract contract IFlashloanReceiver {
    function executeTransaction(address initiator, address token, uint256 amount, uint256 fee, bytes memory params) external virtual;
}