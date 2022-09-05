import hre from 'hardhat';

export const verify = async (address: string, ...args: any[]) => {
    console.log(`Verifying ${address} with constructor args ${args}...`);
    await hre.run("verify:verify", {
        address,
        constructorArguments: args
    });
    console.log(`Verified.`)
}