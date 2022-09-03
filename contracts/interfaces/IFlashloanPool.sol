// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

/// @dev anywhere a fee is referenced, it is a fraction where 1 ether is 100%
/// @author Preston Harrison <https://github.com/Preston-Harrison>
/// @title IFlashLoanPool
abstract contract IFlashloanPool {

    event Loan(
        address indexed initiator, 
        address indexed callTarget, 
        address indexed fundsTarget, 
        uint256 amount,
        uint256 fees
    );

    event Deposit(
        address indexed account,
        uint256 amount
    );

    event Withdraw(
        address indexed account,
        uint256 amount,
        uint256 fees
    );

    /// @dev the depoloyer of this contract
    function FACTORY() external view virtual returns (address);
    /// @dev the ERC20 token for this FlashloanPool
    function TOKEN() external view virtual returns (address);

    /// @dev The maximum fee for flashloans
    uint256 public constant MAX_FEE = 1 ether * 0.005; // 0.5%
    /// @dev the minimum fee for flashloans
    uint256 public constant MIN_FEE = 1 ether * 0.0005; // 0.05%

    /// @dev gets the current owner of this contract. 
    /// This is the address that receives owner fees
    function getOwner() external view virtual returns (address);
    /// @dev gets the current flashloan fee. Always between {MAX_FEE} and {MIN_FEE}
    function flashloanFee() external view virtual returns (uint256);
    
    /// @dev initiates a flashloan transaction by:
    ///     - transferring {amount} of {TOKEN} to {fundsTarget}
    ///     - calling executeTransaction (see IFlashloanReceiver)
    ///     - transferring {amount} + fees from {fundsTarget} to this
    /// @param amount the amount of {TOKEN} to take as a loan
    /// @param callTarget the contract for which to call executeTransaction
    /// @param fundsTarget the account to send the funds to
    /// @param params any paramaters to send in executeTransaction
    function initiateTransaction(uint256 amount, address callTarget, address fundsTarget, bytes memory params) external virtual;

    /// @dev the same as {initiateTransaction}, but it allows the initiator to be set
    /// This should only be callable from the factory
    function initiateTransactionWithInitiator(address initiator, uint256 amount, address callTarget, address fundsTarget, bytes memory params) external virtual;

    /// @dev deposits {amount} of {TOKEN} into the contract
    ///
    /// Some of {amount} goes in as a deposit, some gets moved
    /// directly to fees to offset the fees taken when withdrawing.
    ///
    /// @param amount the amount of {TOKEN} to deposit
    /// @return direct the amount of {amount} that is moved directly to liquidity
    /// @return fees the amount of {amount} that is moved directly to fees
    function deposit(uint256 amount) external virtual returns(uint256 direct, uint256 fees);

    /// @dev withdraws {amount} directly as liquidity, and transfers both it
    /// and fees to the withdrawer
    /// @param amount the amount of liquidity to withdraw
    /// @return amountOut the total amount transfered to the caller
    function withdraw(uint256 amount) external virtual returns (uint256 amountOut);

    /// @dev transfers owner fees to the owner
    function ownerWithdraw() external virtual;
    
    /// @dev transfers developer fees to the developer
    function developerWithdraw() external virtual;
}