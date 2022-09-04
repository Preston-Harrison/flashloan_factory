// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "../interfaces/IFlashloanFactory.sol";
import "../interfaces/IFlashloanPool.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./OwnerToken.sol";
import "./FlashloanPool.sol";

contract FlashloanFactory is AccessControl, IFlashloanFactory {
    bytes32 public constant POOL_CREATOR_ROLE = keccak256("POOL_CREATOR_ROLE");

    /// @dev the address of the developer
    address private _developer;

    /// @dev see {IFlashloanFactory-OWNER_TOKEN}
    address public immutable override OWNER_TOKEN;

    /// @dev mapping of tokens to their pools
    mapping(address => address) public poolForToken;
    
    constructor() {
        // set vars
        _developer = msg.sender;
        OWNER_TOKEN = address(new OwnerToken());

        // set roles
       _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @dev see {IFlashloanFactory-getDeveloper}
    function getDeveloper() public override view returns (address) {
        return _developer;
    }

    /// @dev see {IFlashloanFactory-setDeveloper}
    function setDeveloper(address developer) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        _developer = developer;
    }

    /// @dev see {IFlashloanFactory-createPool}
    function createPool(address token) external override onlyRole(POOL_CREATOR_ROLE) returns (address pool) {
        require(poolForToken[token] == address(0), "FlashloanFactory: Pool already exists");

        pool = address(new FlashloanPool(token));
        poolForToken[token] = pool;

        OwnerToken(OWNER_TOKEN).mint(msg.sender, pool);

        emit CreatePool(msg.sender, token, pool);
    }

    /// @dev see {IFlashloanFactory-initiateTransaction}
    function initiateTransaction(
        address token, 
        uint256 amount, 
        address target, 
        bytes memory params
    ) external override {
        address pool = poolForToken[token];
        require(pool != address(0), "FlashloanFactory: Pool does not exist");
        
        IFlashloanPool(pool).initiateTransactionWithInitiator(msg.sender, amount, target, params);
    }
}