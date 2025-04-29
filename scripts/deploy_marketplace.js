const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("开始部署 NFT Marketplace 合约...");

  // 首先获取之前部署的 NFT 合约地址
  const nftAddress = process.env.NFT_CONTRACT_ADDRESS;
  if (!nftAddress) {
    throw new Error("请先设置 NFT_CONTRACT_ADDRESS 环境变量");
  }
  console.log("使用 NFT 合约地址:", nftAddress);

  // 获取合约工厂
  const NFTMarketplace = await ethers.getContractFactory("NFTMarketplace");
  console.log("合约工厂创建成功");

  // 部署可升级的代理合约
  const marketplace = await upgrades.deployProxy(NFTMarketplace, [nftAddress], {
    initializer: "initialize",
  });
  console.log("等待部署确认...");

  // 等待部署完成
  const deployedMarketplace = await marketplace.waitForDeployment();
  const marketplaceAddress = await deployedMarketplace.getAddress();

  console.log("NFT Marketplace 合约部署成功！");
  console.log("Marketplace 合约地址:", marketplaceAddress);

  // 验证合约初始化是否成功
  const platformFee = await marketplace.platformFee();
  console.log("平台费用:", platformFee.toString(), "基点 (", platformFee.toString() / 100, "%)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 