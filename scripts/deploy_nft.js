const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("开始部署 NFT 合约...");

  // 获取合约工厂
  const NFT = await ethers.getContractFactory("NFT");
  console.log("合约工厂创建成功");

  // 部署可升级的代理合约
  const nft = await upgrades.deployProxy(NFT, [], {
    initializer: "initialize",
  });
  console.log("等待部署确认...");

  // 等待部署完成
  const deployedNFT = await nft.waitForDeployment();
  const nftAddress = await deployedNFT.getAddress();

  console.log("NFT 合约部署成功！");
  console.log("NFT 合约地址:", nftAddress);

  // 验证合约初始化是否成功
  const name = await nft.name();
  const symbol = await nft.symbol();
  console.log("NFT 名称:", name);
  console.log("NFT 符号:", symbol);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 