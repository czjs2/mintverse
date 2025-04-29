const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("开始部署全部合约...\n");

  // 1. 部署 NFT 合约
  console.log("Step 1: 部署 NFT 合约");
  const NFT = await ethers.getContractFactory("NFT");
  const nft = await upgrades.deployProxy(NFT, [], {
    initializer: "initialize",
  });
  const deployedNFT = await nft.waitForDeployment();
  const nftAddress = await deployedNFT.getAddress();
  console.log("NFT 合约部署成功！地址:", nftAddress);
  
  const name = await nft.name();
  const symbol = await nft.symbol();
  console.log("NFT 名称:", name);
  console.log("NFT 符号:", symbol, "\n");

  // 2. 部署 Marketplace 合约
  console.log("Step 2: 部署 NFT Marketplace 合约");
  const NFTMarketplace = await ethers.getContractFactory("NFTMarketplace");
  const marketplace = await upgrades.deployProxy(NFTMarketplace, [nftAddress], {
    initializer: "initialize",
  });
  const deployedMarketplace = await marketplace.waitForDeployment();
  const marketplaceAddress = await deployedMarketplace.getAddress();
  console.log("Marketplace 合约部署成功！地址:", marketplaceAddress);
  
  const platformFee = await marketplace.platformFee();
  console.log("平台费用:", platformFee.toString(), "基点 (", platformFee.toString() / 100, "%)\n");

  // 输出部署总结
  console.log("部署总结:");
  console.log("----------------------------------------");
  console.log("NFT 合约地址:", nftAddress);
  console.log("Marketplace 合约地址:", marketplaceAddress);
  console.log("----------------------------------------");
  
  // 将地址保存到环境变量中（如果需要后续使用）
  process.env.NFT_CONTRACT_ADDRESS = nftAddress;
  process.env.MARKETPLACE_CONTRACT_ADDRESS = marketplaceAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 