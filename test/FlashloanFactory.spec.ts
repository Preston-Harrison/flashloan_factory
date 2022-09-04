import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { FlashloanFactory, FlashloanFactory__factory, MockToken__factory, OwnerToken__factory } from '../typechain-types';
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

    describe("getters and setters", () => {
        it("getter properties should return the correct properties", async () => {
            expect(await FlashloanFactory.getDeveloper()).to.eq(deployer.address);
    
            // basically check the OwnerToken is deployed
            const OwnerToken = await OwnerTokenFactory(user);
            expect(await OwnerToken.symbol()).to.eq("FLASH");
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
        xit("should initiate a transaction with the correct initiator address", async () => {
            // TODO implement
        });
    })
});