import { HardhatUserConfig } from "hardhat/config";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "solidity-coverage";
import "@nomiclabs/hardhat-etherscan";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: "0.8.9",
  networks: {
    hardhat: {
      chainId: 1337
    },
    localhost: {
      url: "http://localhost:8545",
    },
    goerli: {
      url: "https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      accounts: [process.env.PRIVATE_KEY!]
    }
  },
  etherscan: {
    apiKey: "ZBQTAZN8SCM2RZVJWFY215RZ1I9S2AV55X"
  }
};

export default config;
