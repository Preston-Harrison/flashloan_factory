// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

/// @author Preston Harrison <https://github.com/Preston-Harrison>
/// @title IFlashLoanPool
abstract contract IFlashloanPool {

    event Loan(
        address indexed initiator, 
        address indexed target, 
        uint256 amount,
        uint256 fees
    );

    event Deposit(
        address indexed account,
        uint256 amountToDeposit,
        uint256 amountToFees
    );

    event Withdraw(
        address indexed account,
        uint256 amountFromDeposit,
        uint256 amountFromFees
    );

    event ChangeFee(uint256 fee);

    /// @dev the depoloyer of this contract
    function FACTORY() external view virtual returns (address);
    /// @dev the ERC20 token for this FlashloanPool
    function TOKEN() external view virtual returns (address);

    /// @dev gets the current owner of this contract. 
    /// This is the address that receives owner fees
    function getOwner() external view virtual returns (address);
    /// @dev gets the current flashloan fee, which is a fraction where 1 ether is 100%
    function flashloanFee() external view virtual returns (uint256);
    
    /// @dev initiates a flashloan transaction by:
    ///     - transferring {amount} of {TOKEN} to {target}
    ///     - calling executeTransaction on target (see IFlashloanReceiver)
    ///     - transferring {amount} + fees from {target} to this
    /// @param amount the amount of {TOKEN} to take as a loan
    /// @param target the address of the contract receiving the funds, implementing the {IFlashLoanReceiver} interface
    /// @param params any paramaters to send in executeTransaction
    function initiateTransaction(uint256 amount, address target, bytes memory params) external virtual;

    /// @dev the same as {initiateTransaction}, but it allows the initiator to be set
    /// This should only be callable from the factory
    function initiateTransactionWithInitiator(address initiator, uint256 amount, address target, bytes memory params) external virtual;

    /// @dev deposits {amount} of {TOKEN} into the contract
    ///
    /// Some of {amount} goes in as a deposit, some gets moved
    /// directly to fees to offset the fees taken when withdrawing.
    ///
    /// @param amount the amount of {TOKEN} to deposit
    /// @return depositIn the amount of {amount} that is moved directly to liquidity
    /// @return feesIn the amount of {amount} that is moved directly to fees
    function deposit(uint256 amount) external virtual returns(uint256 depositIn, uint256 feesIn);

    /// @dev withdraws {amount} directly as liquidity, and transfers both it
    /// and fees to the withdrawer
    /// @param amount the amount of liquidity to withdraw
    /// @return depositOut the total amount transfered to the caller direct from their deposit
    /// @return feesOut the total amount transfered to the caller from fees
    function withdraw(uint256 amount) external virtual returns (uint256 depositOut, uint256 feesOut);

    /// @dev transfers owner fees to the owner
    function ownerWithdraw() external virtual;
    
    /// @dev transfers developer fees to the developer
    function developerWithdraw() external virtual;
}