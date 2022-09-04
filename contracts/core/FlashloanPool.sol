// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "../interfaces/IFlashloanPool.sol";
import "../interfaces/IFlashloanFactory.sol";
import "../interfaces/IFlashloanReceiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./PoolSettings.sol";

contract FlashloanPool is IFlashloanPool, PoolSettings {
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
    uint256 public override flashloanFee;

    /// @dev mapping of accounts to deposits
    mapping(address => uint256) public deposits;
    /// @dev current collected owner fees
    uint256 public ownerFees;
    /// @dev current collected developer fees
    uint256 public developerFees;
    /// @dev current collected liquidity provider fees
    uint256 internal _providerFees;

    /// @param token the token that this contract will flashloan
    constructor(address token) PoolSettings() {
        FACTORY = msg.sender;
        TOKEN = token;
        _self = address(this);

        flashloanFee = MIN_FEE;
        emit ChangeFee(flashloanFee);
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
        emit ChangeFee(fee);
    }

    /// @dev see {IFlashloanPool-initiateTransaction}
    function initiateTransaction(uint256 amount, address target, bytes memory params) external override {
        _initiateTransaction(msg.sender, amount, target, params);
    }

    /// @dev see {IFlashloanPool-initiateTransactionWithInitiator}
    function initiateTransactionWithInitiator(address initiator, uint256 amount, address target, bytes memory params) external override onlyFactory {
        _initiateTransaction(initiator, amount, target, params);
    }

    /// @dev initiates the transaction. See {IFlashloanPool-initiateTransaction}
    function _initiateTransaction(address initiator, uint256 amount, address target, bytes memory params) internal {
        require(IERC20(TOKEN).balanceOf(_self) >= amount, "FlashloanPool: Not enough liquidity");

        uint256 totalFee = _collectFees(amount);
        require(totalFee >= MIN_FEE_AMOUNT, "FlashloanPool: Loan too small");

        IERC20(TOKEN).safeTransfer(target, amount);
        IFlashloanReceiver(target).executeTransaction(initiator, TOKEN, amount, totalFee, params);
        IERC20(TOKEN).safeTransferFrom(target, _self, amount + totalFee);

        emit Loan(initiator, target, amount, totalFee);
    }

    /// @dev gets the flashloan fees for {amount} and increases associated fee variables
    /// @param amount the amount flashloaned
    /// @return totalFee the total amount of fees to be taken
    function _collectFees(uint256 amount) internal returns (uint256 totalFee) {
        totalFee = flashloanFee * amount / 1 ether;
        _providerFees += (totalFee * PROVIDER_FEE) / 1 ether;
        ownerFees += (totalFee * OWNER_FEE) / 1 ether;
        developerFees += (totalFee * DEVELOPER_FEE) / 1 ether;
    }

    /// @dev gets the ERC20 balance of this contract without the fees
    function getLiquidBalance() internal view returns (uint256) {
        return IERC20(TOKEN).balanceOf(_self) 
            - _providerFees 
            - ownerFees
            - developerFees;
    }

    /// @dev see {IFlashloanPool-deposit}
    function deposit(uint256 amount) external override returns (uint256 depositAmount, uint256 feeAmount) {
        uint256 balance = getLiquidBalance();

        if (balance + _providerFees == 0) {
            depositAmount = amount;
        } else {
            depositAmount = amount * balance / (balance + _providerFees);
        }

        feeAmount = amount - depositAmount;

        deposits[msg.sender] += depositAmount;
        _providerFees += feeAmount;

        IERC20(TOKEN).safeTransferFrom(msg.sender, _self, amount);
        emit Deposit(
            msg.sender,
            depositAmount,
            feeAmount
        );
    }

    /// @dev see {IFlashloanPool-withdraw}
    function withdraw(uint256 amount) external override returns (uint256, uint256) {
        require(deposits[msg.sender] >= amount, "FlashloanPool: Amount over deposit");

        uint256 liquidBalance = getLiquidBalance();
        uint256 feeAmount = amount * _providerFees / liquidBalance;

        deposits[msg.sender] -= amount;
        _providerFees -= feeAmount;

        IERC20(TOKEN).safeTransfer(msg.sender, amount + feeAmount);
        emit Withdraw(
            msg.sender,
            amount,
            feeAmount
        );

        return (amount, feeAmount);
    }

    /// @dev see {IFlashloanPool-ownerWithdraw}
    function ownerWithdraw() external override {
        IERC20(TOKEN).safeTransfer(getOwner(), ownerFees);
        ownerFees = 0;
    }

    /// @dev see {IFlashloanPool-developerWithdraw}
    function developerWithdraw() external override {
        IERC20(TOKEN).safeTransfer(
            IFlashloanFactory(FACTORY).getDeveloper(), 
            developerFees
        );
        developerFees = 0;
    }
}