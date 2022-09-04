import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { FlashloanFactory, FlashloanFactory__factory, FlashloanPool__factory, MockFlashloanReceiver__factory, MockToken__factory, OwnerToken__factory } from '../typechain-types';
import { ethers } from 'hardhat';
import { MockToken } from '../typechain-types/contracts/mocks';

chai.use(solidity);

const POOL_CREATOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_CREATOR_ROLE"));

describe("FlashloanFactory.sol", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let FlashloanFactory: FlashloanFactory;
    let MockToken: MockToken;

    const OwnerTokenFactory = async (signer: SignerWithAddress) => {
        return OwnerToken__factory.connect(await FlashloanFactory.OWNER_TOKEN(), signer);
    }

    beforeEach(async () => {
        [deployer, user] = await ethers.getSigners();
        FlashloanFactory = await new FlashloanFactory__factory(deployer).deploy();
        MockToken = await new MockToken__factory(deployer).deploy();
    });

    it("should create an owner token", async () => {
        // basically check the OwnerToken is deployed
        const OwnerToken = await OwnerTokenFactory(user);
        expect(await OwnerToken.symbol()).to.eq("FLASH");
    });

    describe("getters and setters", () => {
        it("should get and set developer address", async () => {
            const { address } = ethers.Wallet.createRandom();
            await FlashloanFactory.setDeveloper(address);
            expect(await FlashloanFactory.getDeveloper()).to.eq(address);
        });
    });

    describe("creating a pool", () => {
        it("should create a pool if conditions are valid", async () => {
            await FlashloanFactory.grantRole(POOL_CREATOR_ROLE, user.address);
            await expect(FlashloanFactory.connect(user).createPool(
                MockToken.address, 
            )).to.emit(FlashloanFactory, "CreatePool");

            const pool = await FlashloanFactory.poolForToken(MockToken.address);

            const OwnerToken = await OwnerTokenFactory(user);
            expect(await OwnerToken.ownerOf(pool)).to.eq(user.address);
        });
        it("should not create a pool if the pool creator does not have the correct role", async () => {
            await expect(FlashloanFactory.connect(user).createPool(
                MockToken.address, 
            )).to.be.revertedWith(`AccessControl: account ${user.address.toLowerCase()} is missing role ${POOL_CREATOR_ROLE.toLowerCase()}`);
        });
        it("should not create a pool if the pool already exists", async () => {
            await FlashloanFactory.grantRole(POOL_CREATOR_ROLE, user.address);
            await FlashloanFactory.connect(user).createPool(
                MockToken.address,             
            );
            await expect(FlashloanFactory.connect(user).createPool(
                MockToken.address, 
            )).to.be.revertedWith("FlashloanFactory: Pool already exists");
        })
    });
    describe("initiating a transaction", async () => {
        it("should revert if the flashloan pool has not been created", async () => {
            const target = ethers.Wallet.createRandom().address;
            await expect(FlashloanFactory.connect(user).initiateTransaction(
                MockToken.address,
                ethers.utils.parseEther("1"),
                target,
                "0x"
            )).to.be.revertedWith("FlashloanFactory: Pool does not exist");
        });
        it("should initiate a transaction with the correct initiator address", async () => {
            // create pool
            await FlashloanFactory.grantRole(POOL_CREATOR_ROLE, user.address);
            await FlashloanFactory.connect(user).createPool(
                MockToken.address, 
            );

            const LOAN_AMOUNT = ethers.utils.parseEther("1000");

            // deposit into pool
            const FlashloanPool = FlashloanPool__factory.connect(await FlashloanFactory.poolForToken(MockToken.address), user);
            await MockToken.mint(user.address, LOAN_AMOUNT);
            await MockToken.connect(user).approve(FlashloanPool.address, LOAN_AMOUNT);
            await FlashloanPool.connect(user).deposit(LOAN_AMOUNT);
            
            // initiate transaction
            const flashloanFee = await FlashloanPool.flashloanFee();
            const MockFlashloanReceiver = await new MockFlashloanReceiver__factory(user).deploy();
            await expect(FlashloanFactory.connect(user).initiateTransaction(MockToken.address, LOAN_AMOUNT, MockFlashloanReceiver.address, "0x"))
                .to.emit(FlashloanPool, "Loan").withArgs(
                    user.address, 
                    MockFlashloanReceiver.address, 
                    LOAN_AMOUNT, 
                    flashloanFee.mul(LOAN_AMOUNT).div(ethers.constants.WeiPerEther)
                );
        });
    })
});