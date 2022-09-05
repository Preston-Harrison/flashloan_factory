import hre from "hardhat";
import { MockToken__factory } from "../../typechain-types";
import { verify } from "../verify";

export const deployMockToken = async (_verify: boolean) => {
    const [signer] = await hre.ethers.getSigners();
    console.log(`Signer is ${signer.address}. Network is ${hre.network.name}`);
    console.log(`Deploying MockToken...`);
    const MockToken = await new MockToken__factory(signer).deploy();
    await MockToken.deployed(); 
    console.log(`MockToken deployed to ${MockToken.address}`);

    if (_verify) await verify(MockToken.address);
}

deployMockToken(!!process.env.VERIFY)
