import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomicfoundation/hardhat-ethers';
import '@openzeppelin/hardhat-upgrades';
import '@parity/hardhat-polkadot';
import 'hardhat-resolc';
import 'hardhat-revive-node';
import 'dotenv/config';


const config: HardhatUserConfig = {
    solidity: '0.8.28',
    resolc: {
        compilerSource: 'binary',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            evmVersion: 'istanbul',
            compilerPath: './bin/resolc-universal-apple-darwin',
        },
    },
    networks: {
        hardhat: {
            // 移除 polkavm 相关配置，因为我们暂时不需要它
            polkavm: true,
            nodeConfig: {
                nodeBinaryPath: "./bin/substrate-node",
                rpcPort: 8000,
                dev: true,
            },
            adapterConfig: {
                adapterBinaryPath: "./bin/eth-rpc",
                dev: true,
            },
        },
        localNode: {
            polkavm: true,
            url: `http://127.0.0.1:8545`,
            accounts: ["0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133"],
        },
        // ah: {
        //   url: "https://westend-asset-hub-eth-rpc.polkadot.io",
        //   accounts: [process.env.AH_PRIV_KEY],
        // },
    }
};

export default config;
