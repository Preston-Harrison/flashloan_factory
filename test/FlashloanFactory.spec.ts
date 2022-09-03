import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { FlashloanFactory, FlashloanFactory__factory, MockToken__factory, OwnerToken__factory } from '../typechain-types';
import { ethers } from 'hardhat';
import { MockToken } from '../typechain-types/contracts/mocks';

chai.use(solidity);

const MINT_FEE = ethers.utils.parseEther("0.1");

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
        FlashloanFactory = await new FlashloanFactory__factory(deployer).deploy(MINT_FEE);
        MockToken = await new MockToken__factory(deployer).deploy();
    });

    describe("getters and setters", () => {
        it("getter properties should return the correct properties", async () => {
            expect(await FlashloanFactory.mintFee()).to.eq(MINT_FEE);
            expect(await FlashloanFactory.getDeveloper()).to.eq(deployer.address);
    
            // basically check the OwnerToken is deployed
            const OwnerToken = await OwnerTokenFactory(user);
            expect(await OwnerToken.symbol()).to.eq("FLASH");
        });
    });

    describe("creating a pool", () => {
        it("should create a pool if conditions are valid", async () => {
            const oldDeveloperBalance = await ethers.provider.getBalance(deployer.address);
            await expect(FlashloanFactory.connect(user).createPool(
                MockToken.address, 
                { value: MINT_FEE }
            )).to.emit(FlashloanFactory, "CreatePool");
            const newDeveloperBalance = await ethers.provider.getBalance(deployer.address);

            expect(newDeveloperBalance.sub(oldDeveloperBalance)).to.eq(MINT_FEE);

            const pool = await FlashloanFactory.poolForToken(MockToken.address);

            const OwnerToken = await OwnerTokenFactory(user);
            expect(await OwnerToken.ownerOf(pool)).to.eq(user.address);
        });
        it("should not create a pool if the mint fee is incorrect", async () => {
            await expect(FlashloanFactory.connect(user).createPool(
                MockToken.address, 
                { value: MINT_FEE.sub(1) }
            )).to.be.revertedWith("FlashloanFactory: Wrong fee paid");
            await expect(FlashloanFactory.connect(user).createPool(
                MockToken.address, 
                { value: MINT_FEE.add(1) }
            )).to.be.revertedWith("FlashloanFactory: Wrong fee paid");
        });
        it("should not create a pool if the pool already exists", async () => {
            await FlashloanFactory.connect(user).createPool(
                MockToken.address, 
                { value: MINT_FEE }
            );
            await expect(FlashloanFactory.connect(user).createPool(
                MockToken.address, 
                { value: MINT_FEE }
            )).to.be.revertedWith("FlashloanFactory: Pool already exists");
        })
    });
});