import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { FlashloanFactory, FlashloanFactory__factory, FlashloanPool, FlashloanPool__factory, MockFlashloanReceiver__factory, MockToken__factory, OwnerToken__factory } from '../typechain-types';
import { ethers } from 'hardhat';
import { MockFlashloanReceiver, MockToken } from '../typechain-types/contracts/mocks';

chai.use(solidity);

const POOL_CREATOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_CREATOR_ROLE"));
const LOAN_AMOUNT = ethers.utils.parseEther("1000");

describe("FlashloanPool.sol", () => {
    let deployer: SignerWithAddress;
    let poolCreator: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let FlashloanFactory: FlashloanFactory;
    let FlashloanPool: FlashloanPool
    let MockToken: MockToken;
    let MockFlashloanReceiver: MockFlashloanReceiver;

    const OwnerTokenFactory = async (signer: SignerWithAddress) => {
        return OwnerToken__factory.connect(await FlashloanFactory.OWNER_TOKEN(), signer);
    }

    beforeEach(async () => {
        [deployer, poolCreator, user1, user2] = await ethers.getSigners();
        FlashloanFactory = await new FlashloanFactory__factory(deployer).deploy();
        MockToken = await new MockToken__factory(deployer).deploy();
        await FlashloanFactory.grantRole(POOL_CREATOR_ROLE, poolCreator.address);
        await FlashloanFactory.connect(poolCreator).createPool(MockToken.address);
        FlashloanPool = FlashloanPool__factory.connect(await FlashloanFactory.poolForToken(MockToken.address), poolCreator);
        MockFlashloanReceiver = await new MockFlashloanReceiver__factory(deployer).deploy();
    });

    describe("getters and setters", () => {
        it("should get the owner of the pool, even after transfers", async () => {
            expect(await FlashloanPool.getOwner()).to.eq(poolCreator.address);
            await (await OwnerTokenFactory(poolCreator)).transferFrom(poolCreator.address, user1.address, FlashloanPool.address);
            expect(await FlashloanPool.getOwner()).to.eq(user1.address);
        });
        it("should get and set the fee", async () => {
            const maxFee = await FlashloanPool.MAX_FEE();
            const minFee = await FlashloanPool.MIN_FEE();
            expect(await FlashloanPool.flashloanFee()).to.eq(minFee);
            await FlashloanPool.connect(poolCreator).setFee(maxFee);
            expect(await FlashloanPool.flashloanFee()).to.eq(maxFee);

            await expect(FlashloanPool.setFee(maxFee.add(1))).to.be.revertedWith("FlashloanPool: Fee above maximum");
            await expect(FlashloanPool.setFee(minFee.sub(1))).to.be.revertedWith("FlashloanPool: Fee below minimum");
            await expect(FlashloanPool.connect(user1).setFee(minFee.sub(1)))
                .to.be.revertedWith("FlashloanPool: Caller not owner");
        });
        it("should have correct factory and token addresses", async () => {
            expect(await FlashloanPool.FACTORY()).to.eq(FlashloanFactory.address);
            expect(await FlashloanPool.TOKEN()).to.eq(MockToken.address);
        });
    });

    describe("depositing and withdrawing", () => {
        it("should allow a user to deposit and withdraw when the pool is empty", async () => {
            await MockToken.mint(user1.address, LOAN_AMOUNT);
            await MockToken.connect(user1).approve(FlashloanPool.address, LOAN_AMOUNT);

            await expect(FlashloanPool.connect(user1).deposit(LOAN_AMOUNT))
                .to.emit(FlashloanPool, "Deposit").withArgs(user1.address, LOAN_AMOUNT, 0);

            await expect(FlashloanPool.connect(user1).withdraw(LOAN_AMOUNT))
                .to.emit(FlashloanPool, "Withdraw").withArgs(user1.address, LOAN_AMOUNT, 0);
            
            expect(await MockToken.balanceOf(user1.address)).to.eq(LOAN_AMOUNT);
            expect(await FlashloanPool.deposits(user1.address)).to.eq(0);
        });
        it("should allow a user to deposit when the pool already has funds, but no fees", async () => {
            await MockToken.mint(user1.address, LOAN_AMOUNT);
            await MockToken.mint(user2.address, LOAN_AMOUNT);
            await MockToken.connect(user1).approve(FlashloanPool.address, LOAN_AMOUNT);
            await MockToken.connect(user2).approve(FlashloanPool.address, LOAN_AMOUNT);

            await expect(FlashloanPool.connect(user1).deposit(LOAN_AMOUNT))
                .to.emit(FlashloanPool, "Deposit").withArgs(user1.address, LOAN_AMOUNT, 0);

            await expect(FlashloanPool.connect(user2).deposit(LOAN_AMOUNT))
                .to.emit(FlashloanPool, "Deposit").withArgs(user2.address, LOAN_AMOUNT, 0);

            await expect(FlashloanPool.connect(user2).withdraw(LOAN_AMOUNT))
                .to.emit(FlashloanPool, "Withdraw").withArgs(user2.address, LOAN_AMOUNT, 0);

            expect(await MockToken.balanceOf(user2.address)).to.eq(LOAN_AMOUNT);
            expect(await FlashloanPool.deposits(user2.address)).to.eq(0);

            await expect(FlashloanPool.connect(user1).withdraw(LOAN_AMOUNT))
                .to.emit(FlashloanPool, "Withdraw").withArgs(user1.address, LOAN_AMOUNT, 0);

            expect(await MockToken.balanceOf(user1.address)).to.eq(LOAN_AMOUNT);
            expect(await FlashloanPool.deposits(user1.address)).to.eq(0);
        });
        it("should allow a user to deposit when the pool already has funds, and fees", async () => {
            const flashloanFee = await FlashloanPool.flashloanFee();
            const providerFee = await FlashloanPool.PROVIDER_FEE();
            await MockToken.mint(user1.address, LOAN_AMOUNT);
            await MockToken.mint(user2.address, LOAN_AMOUNT);
            await MockToken.connect(user1).approve(FlashloanPool.address, LOAN_AMOUNT);
            await MockToken.connect(user2).approve(FlashloanPool.address, LOAN_AMOUNT);

            await expect(FlashloanPool.connect(user1).deposit(LOAN_AMOUNT))
                .to.emit(FlashloanPool, "Deposit").withArgs(user1.address, LOAN_AMOUNT, 0);

            await FlashloanFactory.connect(user1).initiateTransaction(MockToken.address, LOAN_AMOUNT, MockFlashloanReceiver.address, "0x");
            const expectedFee = LOAN_AMOUNT.mul(flashloanFee).div(ethers.constants.WeiPerEther);
            const expectedProviderFee = expectedFee.mul(providerFee).div(ethers.constants.WeiPerEther);
            expect(await FlashloanPool.accumulatedProviderFees()).to.eq(expectedProviderFee);

            const depositAmount = LOAN_AMOUNT.mul(LOAN_AMOUNT).div(LOAN_AMOUNT.add(expectedProviderFee));
            await expect(FlashloanPool.connect(user2).deposit(LOAN_AMOUNT))
                .to.emit(FlashloanPool, "Deposit").withArgs(user2.address, depositAmount, LOAN_AMOUNT.sub(depositAmount));
            
            await expect(FlashloanPool.connect(user2).withdraw(depositAmount))
                .to.emit(FlashloanPool, "Withdraw").withArgs(user2.address, depositAmount, LOAN_AMOUNT.sub(depositAmount).sub(1)); // sub 1 for rounding error

            expect(await MockToken.balanceOf(user2.address)).to.eq(LOAN_AMOUNT.sub(1)); // rounding error
            expect(await FlashloanPool.deposits(user2.address)).to.eq(0);

            await expect(FlashloanPool.connect(user1).withdraw(LOAN_AMOUNT))
                .to.emit(FlashloanPool, "Withdraw").withArgs(user1.address, LOAN_AMOUNT, expectedProviderFee.add(1)); // rounding error

            expect(await MockToken.balanceOf(user1.address)).to.eq(LOAN_AMOUNT.add(expectedProviderFee).add(1)); // rounding error
            expect(await FlashloanPool.deposits(user1.address)).to.eq(0);

            expect(await FlashloanPool.accumulatedProviderFees()).to.eq(0);
        });
        it("should allow the developer and owner to withdraw fees", async () => {
            const flashloanFee = await FlashloanPool.flashloanFee();
            const developerFee = await FlashloanPool.DEVELOPER_FEE();
            const ownerFee = await FlashloanPool.OWNER_FEE();
            const developer = await FlashloanFactory.getDeveloper();

            await MockToken.mint(user1.address, LOAN_AMOUNT);
            await MockToken.connect(user1).approve(FlashloanPool.address, LOAN_AMOUNT);

            await expect(FlashloanPool.connect(user1).deposit(LOAN_AMOUNT))
                .to.emit(FlashloanPool, "Deposit").withArgs(user1.address, LOAN_AMOUNT, 0);

            await FlashloanFactory.connect(user1).initiateTransaction(MockToken.address, LOAN_AMOUNT, MockFlashloanReceiver.address, "0x");

            const expectedFee = LOAN_AMOUNT.mul(flashloanFee).div(ethers.constants.WeiPerEther);

            await FlashloanPool.ownerWithdraw();
            await FlashloanPool.developerWithdraw();

            expect(await MockToken.balanceOf(developer)).to.eq(expectedFee.mul(developerFee).div(ethers.constants.WeiPerEther));
            expect(await MockToken.balanceOf(poolCreator.address)).to.eq(expectedFee.mul(ownerFee).div(ethers.constants.WeiPerEther));
        });
        it("should withdraw owner fees on owner token transfer", async () => {
            const flashloanFee = await FlashloanPool.flashloanFee();
            const ownerFee = await FlashloanPool.OWNER_FEE();

            await MockToken.mint(user1.address, LOAN_AMOUNT);
            await MockToken.connect(user1).approve(FlashloanPool.address, LOAN_AMOUNT);

            await expect(FlashloanPool.connect(user1).deposit(LOAN_AMOUNT))
                .to.emit(FlashloanPool, "Deposit").withArgs(user1.address, LOAN_AMOUNT, 0);

            await FlashloanFactory.connect(user1).initiateTransaction(MockToken.address, LOAN_AMOUNT, MockFlashloanReceiver.address, "0x");

            const expectedFee = LOAN_AMOUNT.mul(flashloanFee).div(ethers.constants.WeiPerEther);
            await (await OwnerTokenFactory(poolCreator)).transferFrom(
                poolCreator.address, 
                ethers.Wallet.createRandom().address, 
                FlashloanPool.address
            );

            expect(await MockToken.balanceOf(poolCreator.address)).to.eq(expectedFee.mul(ownerFee).div(ethers.constants.WeiPerEther));
        });
        it("should not let users to withdraw more than they deposited", async () => {
            await MockToken.mint(user1.address, LOAN_AMOUNT);
            await MockToken.connect(user1).approve(FlashloanPool.address, LOAN_AMOUNT);

            await expect(FlashloanPool.connect(user1).deposit(LOAN_AMOUNT))
                .to.emit(FlashloanPool, "Deposit").withArgs(user1.address, LOAN_AMOUNT, 0);

            await expect(FlashloanPool.connect(user1).withdraw(LOAN_AMOUNT.add(1)))
                .to.be.revertedWith("FlashloanPool: Amount over deposit");
        });
    });

    describe("initiating a transaction", () => {
        it("should initiate a valid transaction", async () => {
            const flashloanFee = await FlashloanPool.flashloanFee();
            await MockToken.mint(user1.address, LOAN_AMOUNT);
            await MockToken.connect(user1).approve(FlashloanPool.address, LOAN_AMOUNT);

            await expect(FlashloanPool.connect(user1).deposit(LOAN_AMOUNT))
                .to.emit(FlashloanPool, "Deposit").withArgs(user1.address, LOAN_AMOUNT, 0);

            const fee = LOAN_AMOUNT.mul(flashloanFee).div(ethers.constants.WeiPerEther);
            const tx = FlashloanPool.connect(user1).initiateTransaction(LOAN_AMOUNT, MockFlashloanReceiver.address, "0x");
            await expect(tx).to.emit(FlashloanPool, "Loan").withArgs(user1.address, MockFlashloanReceiver.address, LOAN_AMOUNT, fee);
            expect(await MockToken.balanceOf(FlashloanPool.address)).to.eq(LOAN_AMOUNT.add(fee));
        });
        it("should reject invalid flashloan attempts", async () => {
            {
                const tx = FlashloanPool.connect(user1).initiateTransaction(LOAN_AMOUNT, MockFlashloanReceiver.address, "0x");
                await expect(tx).to.be.revertedWith("FlashloanPool: Not enough liquidity");
            }

            await MockToken.mint(user1.address, LOAN_AMOUNT);
            await MockToken.connect(user1).approve(FlashloanPool.address, LOAN_AMOUNT);

            await expect(FlashloanPool.connect(user1).deposit(LOAN_AMOUNT))
                .to.emit(FlashloanPool, "Deposit").withArgs(user1.address, LOAN_AMOUNT, 0);
            
            {
                const minFeeAmount = await FlashloanPool.MIN_FEE_AMOUNT();
                const tx = FlashloanPool.connect(user1).initiateTransaction(minFeeAmount.sub(1), MockFlashloanReceiver.address, "0x");
                await expect(tx).to.be.revertedWith("FlashloanPool: Loan too small");
            }

            const tx = FlashloanPool.connect(user1).initiateTransactionWithInitiator(
                ethers.Wallet.createRandom().address, 
                LOAN_AMOUNT, 
                MockFlashloanReceiver.address, 
                "0x"
            );
            await expect(tx).to.be.revertedWith("FlashloanPool: Caller not factory");
        });
    })
});