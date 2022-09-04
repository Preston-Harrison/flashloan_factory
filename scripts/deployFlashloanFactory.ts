import hre from "hardhat";
import { FlashloanFactory__factory } from "../typechain-types";

const main = async () => {
    const [signer] = await hre.ethers.getSigners();
    console.log(`Deploying FlashloanFactory from ${signer.address} to network ${hre.network.name}`);
    const FlashloanFactory = await new FlashloanFactory__factory(signer).deploy();
    await FlashloanFactory.deployed();
    console.log(`Deployed FlashloanFactory to ${FlashloanFactory.address}`);
}

main();