import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@parity/hardhat-polkadot';
import '@openzeppelin/hardhat-upgrades';

const config:  any = {
    solidity: '0.8.28',
    resolc: {
        compilerSource: 'npm',
    },
    networks: {
        hardhat: {
            polkavm: true,
            nodeConfig: {
                nodeBinaryPath: "../substrate-node",
                rpcPort: 8000,
                dev: true,
            },
            adapterConfig: {
                adapterBinaryPath: "/home/wy150150/polkadot/eth-rpc",
                dev: true,
            },
        },
        localNode: {
            polkavm: true,
            url: `http://127.0.0.1:8545`,
            accounts: ["0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133"],
        },
        // westendAssetHub: {
        //     polkavm: true,
        //     url: 'https://westend-asset-hub-eth-rpc.polkadot.io',
        //     accounts: [process.env.PRIVATE_KEY],
        // },
    }
};

export default config;
