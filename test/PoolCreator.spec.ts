import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { FlashloanFactory, FlashloanFactory__factory, MockToken__factory, PoolCreator, PoolCreator__factory } from '../typechain-types';
import { ethers } from 'hardhat';
import { MockToken } from '../typechain-types/contracts/mocks';

chai.use(solidity);

const ONE_TIME_MINT_FEE = ethers.utils.parseEther("0.5");
const MULTI_MINT_FEE = ethers.utils.parseEther("0.3");
const POOL_CREATOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_CREATOR_ROLE"));

describe("PoolCreator.sol", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let FlashloanFactory: FlashloanFactory;
    let MockToken: MockToken;
    let PoolCreator: PoolCreator;

    beforeEach(async () => {
        [deployer, user] = await ethers.getSigners();
        FlashloanFactory = await new FlashloanFactory__factory(deployer).deploy();
        MockToken = await new MockToken__factory(deployer).deploy();
        PoolCreator = await new PoolCreator__factory(deployer).deploy(FlashloanFactory.address, ONE_TIME_MINT_FEE, MULTI_MINT_FEE);
        await FlashloanFactory.grantRole(POOL_CREATOR_ROLE, PoolCreator.address);
    });

    describe("getters and setters", () => {
        it("should set fees correctly", async () => {
            expect(await PoolCreator.multiMintFee()).to.eq(MULTI_MINT_FEE);
            expect(await PoolCreator.oneTimeMintFee()).to.eq(ONE_TIME_MINT_FEE);
            
            await expect(PoolCreator.setFees(ONE_TIME_MINT_FEE.div(2), MULTI_MINT_FEE.div(2)))
                .to.emit(PoolCreator, "ChangeFees").withArgs(ONE_TIME_MINT_FEE.div(2), MULTI_MINT_FEE.div(2));
            expect(await PoolCreator.multiMintFee()).to.eq(MULTI_MINT_FEE.div(2));
            expect(await PoolCreator.oneTimeMintFee()).to.eq(ONE_TIME_MINT_FEE.div(2));
        });
        it("should get and set fee exemptions", async () => {
            await expect(PoolCreator.setFeeExemption(user.address, true))
                .to.emit(PoolCreator, "SetFeeExempt").withArgs(user.address, true);
            expect(await PoolCreator.isFeeExempt(user.address)).to.be.true;
        });
        it("should not allow users that are not the owner to set values", async () => {
            await expect(PoolCreator.connect(user).setFees(0, 0)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(PoolCreator.connect(user).setFeeExemption(user.address, true)).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("creating a pool", () => {
        it("should create one pool with one time fees", async () => {
            await PoolCreator.createPool(MockToken.address, {
                value: ONE_TIME_MINT_FEE
            });
            expect(await FlashloanFactory.poolForToken(MockToken.address)).to.not.eq(ethers.constants.AddressZero);
        });
        it("should allow fee exempt users to create fees without paying", async () => {
            await PoolCreator.setFeeExemption(user.address, true);
            await PoolCreator.connect(user).createPool(MockToken.address);
            expect(await FlashloanFactory.poolForToken(MockToken.address)).to.not.eq(ethers.constants.AddressZero);
        });
        it("should create multiple pools with multiple fees", async () => {
            const MockToken2 = await new MockToken__factory(deployer).deploy();

            await PoolCreator.createPools([MockToken.address, MockToken2.address], {
                value: MULTI_MINT_FEE.mul(2)
            });
            expect(await FlashloanFactory.poolForToken(MockToken.address)).to.not.eq(ethers.constants.AddressZero);
            expect(await FlashloanFactory.poolForToken(MockToken2.address)).to.not.eq(ethers.constants.AddressZero);
        });
        it("should revert if an invalid fee is paid", async () => {
            const MockToken2 = await new MockToken__factory(deployer).deploy();

            await expect(PoolCreator.createPool(MockToken.address, {
                value: ONE_TIME_MINT_FEE.sub(1)
            })).to.be.revertedWith("PoolCreator: Invalid msg.value");

            await expect(PoolCreator.createPools([MockToken.address, MockToken2.address], {
                value: MULTI_MINT_FEE.mul(2).sub(1)
            })).to.be.revertedWith("PoolCreator: Invalid msg.value");

            await PoolCreator.setFeeExemption(user.address, true);
            await expect(PoolCreator.connect(user).createPools([MockToken.address, MockToken2.address], {
                value: MULTI_MINT_FEE.mul(2)
            })).to.be.revertedWith("PoolCreator: Caller is fee exempt");
        });
        it("should revert if only one token is passed into createPools", async () => {
            await expect(PoolCreator.createPools([MockToken.address], {
                value: MULTI_MINT_FEE
            })).to.be.revertedWith("PoolCreator: Must provide multiple tokens");
        });
    });

    describe("withdrawing funds", () => {
        it("should allow the owner to withdraw funds", async () => {
            await PoolCreator.createPool(MockToken.address, {
                value: ONE_TIME_MINT_FEE
            });
            const oldBalance = await ethers.provider.getBalance(deployer.address);
            expect(await ethers.provider.getBalance(PoolCreator.address)).to.eq(ONE_TIME_MINT_FEE);
            await PoolCreator.connect(user).withdraw();
            const newBalance = await ethers.provider.getBalance(deployer.address);
            expect(newBalance.sub(oldBalance)).to.eq(ONE_TIME_MINT_FEE);
        });
    });
});