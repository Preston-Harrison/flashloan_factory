import hre from "hardhat";
import { FlashloanFactory__factory, PoolCreator__factory } from "../typechain-types";

const ONE_TIME_MINT_FEE = hre.ethers.utils.parseEther("0.5");
const MULTI_MINT_FEE = hre.ethers.utils.parseEther("0.3");
const POOL_CREATOR_ROLE = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("POOL_CREATOR_ROLE"));

const main = async () => {
    const [signer] = await hre.ethers.getSigners();
    console.log(`Signer is ${signer.address}. Network is ${hre.network.name}`);
    console.log(`Deploying FlashloanFactory...`);
    const FlashloanFactory = await new FlashloanFactory__factory(signer).deploy();
    await FlashloanFactory.deployed();
    console.log(`Deployed FlashloanFactory to ${FlashloanFactory.address}`);

    console.log(`Deploying PoolCreator...`)
    const PoolCreator = await new PoolCreator__factory(signer).deploy(FlashloanFactory.address, ONE_TIME_MINT_FEE, MULTI_MINT_FEE);
    await PoolCreator.deployed();
    console.log(`Deployed PoolCreator to ${PoolCreator.address}`);

    console.log(`Granting POOL_CREATOR_ROLE to PoolCreator...`);
    const tx = await FlashloanFactory.grantRole(POOL_CREATOR_ROLE, PoolCreator.address);
    await tx.wait();
    console.log(`Granted`)
}

main();