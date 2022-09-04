// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "../interfaces/IFlashloanReceiver.sol";
import "./MockToken.sol";

contract MockFlashloanReceiver is IFlashloanReceiver {
    function executeTransaction(address /* initiator */, address token, uint256 amount, uint256 fee, bytes memory /* params */) external override {
        MockToken(token).mint(address(this), fee);
        MockToken(token).approve(msg.sender, amount + fee);
    }
}