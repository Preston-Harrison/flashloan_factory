// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "../interfaces/IFlashloanPool.sol";
import "../interfaces/IFlashloanFactory.sol";
import "../interfaces/IFlashloanReceiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract FlashloanPool is IFlashloanPool {
    using SafeERC20 for IERC20;

    modifier onlyOwner {
        require(msg.sender == getOwner(), "FlashloanPool: Caller not owner");
        _;
    }

    modifier onlyFactory {
        require(msg.sender == FACTORY, "FlashloanPool: Caller not factory");
        _;
    }

    /// @dev see {IFlashloanPool-FACTORY}
    address public immutable override FACTORY;
    /// @dev see {IFlashloanPool-TOKEN}
    address public immutable override TOKEN;
    /// @dev the address of this contract
    address internal immutable _self;

    /// @dev see {IFlashloanPool-flashloanFee}
    uint256 public override flashloanFee = MIN_FEE;

    mapping(address => uint256) public deposits;
    uint256 public accumulatedOwnerFees;
    uint256 public accumulatedDeveloperFees;
    uint256 accumulatedProviderFees;

    /// @param token the token that this contract will flashloan
    constructor(address token) {
        FACTORY = msg.sender;
        TOKEN = token;
        _self = address(this);
    }

    /// @dev see {IFlashloanPool-getOwner}
    function getOwner() public override view returns (address) {
        address ownerToken = IFlashloanFactory(FACTORY).OWNER_TOKEN();
        return IERC721(ownerToken).ownerOf(uint256(uint160(_self)));
    }

    /// @dev sets the new flashloanFee
    /// @param fee the new fee
    function setFee(uint256 fee) external onlyOwner {
        require(fee >= MIN_FEE, "FlashloanPool: Fee below minimum");
        require(fee <= MAX_FEE, "FlashloanPool: Fee above maximum");
        flashloanFee = fee;
    }

    /// @dev see {IFlashloanPool-initiateTransaction}
    function initiateTransaction(uint256 amount, address target, bytes memory params) external override {
        _initiateTransaction(msg.sender, amount, target, params);
    }

    /// @dev see {IFlashloanPool-initiateTransactionWithInitiator}
    function initiateTransactionWithInitiator(address initiator, uint256 amount, address target, bytes memory params) external override {
        _initiateTransaction(initiator, amount, target, params);
    }

    function _initiateTransaction(address initiator, uint256 amount, address target, bytes memory params) internal onlyFactory {
        require(IERC20(TOKEN).balanceOf(_self) >= amount, "FlashloanPool: Not enough liquidity");

        IERC20(TOKEN).safeTransfer(target, amount);

        uint256 totalFee = _collectFees(amount);
        IFlashloanReceiver(target).executeTransaction(initiator, TOKEN, amount, totalFee, params);
        IERC20(TOKEN).safeTransferFrom(target, _self, amount + totalFee);

        emit Loan(initiator, target, amount, totalFee);
    }

    /// @dev gets the flashloan fees for {amount} and increases associated fee variables
    /// @param amount the amount flashloaned
    /// @return totalFee the total amount of fees to be taken
    function _collectFees(uint256 amount) internal returns (uint256 totalFee) {
        totalFee = flashloanFee * amount / 1 ether;
        accumulatedProviderFees += (totalFee * 7) / 10;
        accumulatedOwnerFees += (totalFee * 2) / 10;
        accumulatedDeveloperFees += (totalFee * 1) / 10;
    }

    /// @dev gets the ERC20 balance of this contract without the fees
    function getLiquidBalance() internal view returns (uint256) {
        return IERC20(TOKEN).balanceOf(_self) 
            - accumulatedProviderFees 
            - accumulatedOwnerFees
            - accumulatedDeveloperFees;
    }

    /// @dev see {IFlashloanPool-deposit}
    function deposit(uint256 amount) external override returns (uint256 depositAmount, uint256 feeAmount) {
        uint256 balance = getLiquidBalance();

        depositAmount = amount * balance / (amount + balance);
        feeAmount = amount - depositAmount;

        deposits[msg.sender] += depositAmount;
        accumulatedProviderFees += feeAmount;

        IERC20(TOKEN).safeTransferFrom(msg.sender, _self, amount);
        emit Deposit(
            msg.sender,
            depositAmount,
            feeAmount
        );
    }

    /// @dev see {IFlashloanPool-withdraw}
    function withdraw(uint256 amount) external override returns (uint256) {
        require(deposits[msg.sender] >= amount, "FlashloanPool: Amount over deposit");

        uint256 liquidBalance = getLiquidBalance();
        uint256 feeAmount = amount * accumulatedProviderFees / liquidBalance;

        deposits[msg.sender] -= amount;
        accumulatedProviderFees -= feeAmount;

        IERC20(TOKEN).safeTransfer(msg.sender, amount + feeAmount);
        emit Withdraw(
            msg.sender,
            amount,
            feeAmount
        );
        return amount + feeAmount;
    }

    /// @dev see {IFlashloanPool-ownerWithdraw}
    function ownerWithdraw() external override {
        IERC20(TOKEN).safeTransfer(getOwner(), accumulatedOwnerFees);
        accumulatedOwnerFees = 0;
    }

    /// @dev see {IFlashloanPool-developerWithdraw}
    function developerWithdraw() external override {
        IERC20(TOKEN).safeTransfer(
            IFlashloanFactory(FACTORY).getDeveloper(), 
            accumulatedDeveloperFees
        );
        accumulatedDeveloperFees = 0;
    }
}