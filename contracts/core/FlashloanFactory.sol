// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "../interfaces/IFlashloanFactory.sol";
import "../interfaces/IFlashloanPool.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./OwnerToken.sol";
import "./FlashloanPool.sol";

contract FlashloanFactory is Ownable, IFlashloanFactory {
    /// @dev see {IFlashloanFactory-OWNER_TOKEN}
    address public immutable override OWNER_TOKEN;
    /// @dev see {IFlashloanFactory-mintFee}
    uint256 public override mintFee;

    /// @dev mapping of tokens to their pools
    mapping(address => address) public poolForToken;
    
    constructor(uint256 _mintFee) {
        mintFee = _mintFee;
        OWNER_TOKEN = address(new OwnerToken());
    }

    /// @dev see {IFlashloanFactory-getDeveloper}
    function getDeveloper() public override view returns (address) {
        return owner();
    }

    /// @dev see {IFlashloanFactory-createPool}
    function createPool(address token) external payable override returns (address pool) {
        require(msg.value == mintFee, "FlashloanFactory: Wrong fee paid");
        require(poolForToken[token] == address(0), "FlashloanFactory: Pool already exists");

        pool = address(new FlashloanPool(token));
        poolForToken[token] = pool;

        OwnerToken(OWNER_TOKEN).mint(msg.sender, pool);
        payable(getDeveloper()).transfer(msg.value);

        emit CreatePool(token, pool, msg.value);
    }

    /// @dev see {IFlashloanFactory-initiateTransaction}
    function initiateTransaction(
        address token, 
        uint256 amount, 
        address callTarget, 
        address fundsTarget, 
        bytes memory params
    ) external override {
        address pool = poolForToken[token];
        require(pool != address(0), "FlashloanFactory: Pool already exists");
        
        IFlashloanPool(pool).initiateTransactionWithInitiator(msg.sender, amount, callTarget, fundsTarget, params);
    }
}