const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("NFT Marketplace", function () {
  let nft;
  let marketplace;
  let owner;
  let seller;
  let buyer;
  let tokenId;
  const price = ethers.parseEther("1.0");
  const tokenURI = "ipfs://QmTest";

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();

    // 部署NFT合约
    const NFT = await ethers.getContractFactory("NFT");
    nft = await upgrades.deployProxy(NFT, [], {
      initializer: "initialize",
    });

    // 部署市场合约
    const NFTMarketplace = await ethers.getContractFactory("NFTMarketplace");
    marketplace = await upgrades.deployProxy(NFTMarketplace, [nft.address], {
      initializer: "initialize",
    });

    // 铸造NFT
    await nft.connect(owner).mint(seller.address, tokenURI);
    tokenId = 1;
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await marketplace.owner()).to.equal(owner.address);
    });

    it("Should set the correct platform fee", async function () {
      expect(await marketplace.platformFee()).to.equal(200); // 2%
    });

    it("Should set the default expiration blocks", async function () {
      expect(await marketplace.defaultExpirationBlocks()).to.equal(500);
    });

    it("Should set the maximum board capacity", async function () {
      expect(await marketplace.maxBoardCapacity()).to.equal(100);
    });
  });

  describe("NFT Listing", function () {
    it("Should list NFT successfully", async function () {
      await nft.connect(seller).approve(marketplace.address, tokenId);
      await marketplace.connect(seller).listNFT(tokenId, price);

      const listing = await marketplace.getListing(tokenId);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(price);
      expect(listing.isActive).to.be.true;
      
      // 确认上架时间和过期时间正确设置
      expect(listing.listingTime).to.be.gt(0);
      expect(listing.expirationTime).to.equal(listing.listingTime + 500);
    });

    it("Should list NFT with custom expiration", async function () {
      await nft.connect(seller).approve(marketplace.address, tokenId);
      const customExpiration = 1000;
      await marketplace.connect(seller).listNFTWithExpiration(tokenId, price, customExpiration);

      const listing = await marketplace.getListing(tokenId);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(price);
      expect(listing.isActive).to.be.true;
      
      // 确认上架时间和过期时间正确设置
      const blockNumber = await ethers.provider.getBlockNumber();
      expect(listing.listingTime).to.equal(blockNumber);
      expect(listing.expirationTime).to.equal(blockNumber + customExpiration);
    });

    it("Should add listing to the board", async function () {
      await nft.connect(seller).approve(marketplace.address, tokenId);
      await marketplace.connect(seller).listNFT(tokenId, price);

      const boardListings = await marketplace.getBoardListings();
      expect(boardListings.length).to.equal(1);
      expect(boardListings[0]).to.equal(tokenId);
    });

    it("Should fail to list NFT if not owner", async function () {
      await expect(
        marketplace.connect(buyer).listNFT(tokenId, price)
      ).to.be.revertedWith("Not the owner");
    });

    it("Should fail to list NFT with zero price", async function () {
      await expect(
        marketplace.connect(seller).listNFT(tokenId, 0)
      ).to.be.revertedWith("Price must be greater than 0");
    });
  });

  describe("NFT Buying", function () {
    beforeEach(async function () {
      await nft.connect(seller).approve(marketplace.address, tokenId);
      await marketplace.connect(seller).listNFT(tokenId, price);
    });

    it("Should buy NFT successfully", async function () {
      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

      await marketplace.connect(buyer).buyNFT(tokenId, { value: price });

      expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);
      
      const listing = await marketplace.getListing(tokenId);
      expect(listing.isActive).to.be.false;

      // 检查看板是否已移除
      const boardListings = await marketplace.getBoardListings();
      expect(boardListings.length).to.equal(0);

      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      // 验证卖家收到的金额（减去平台费用）
      const platformFee = price * 200n / 10000n; // 2% 平台费用
      const sellerAmount = price - platformFee;
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(sellerAmount);

      // 验证平台收到的费用
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(platformFee);
    });

    it("Should update buyer assets after purchase", async function () {
      await marketplace.connect(buyer).buyNFT(tokenId, { value: price });
      
      const buyerAssets = await marketplace.getMyAssets({ from: buyer.address });
      expect(buyerAssets.length).to.equal(1);
      expect(buyerAssets[0]).to.equal(tokenId);
    });

    it("Should fail to buy NFT with insufficient payment", async function () {
      const insufficientPrice = ethers.parseEther("0.5");
      await expect(
        marketplace.connect(buyer).buyNFT(tokenId, { value: insufficientPrice })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should fail to buy inactive listing", async function () {
      await marketplace.connect(seller).cancelListing(tokenId);
      await expect(
        marketplace.connect(buyer).buyNFT(tokenId, { value: price })
      ).to.be.revertedWith("Listing is not active");
    });

    it("Should fail to buy expired listing", async function () {
      // 创建一个1区块后过期的NFT
      await nft.connect(owner).mint(seller.address, tokenURI);
      const newTokenId = 2;
      await nft.connect(seller).approve(marketplace.address, newTokenId);
      await marketplace.connect(seller).listNFTWithExpiration(newTokenId, price, 1);
      
      // 先进行一笔交易，让区块数增加
      await marketplace.connect(owner).setPlatformFee(200);
      
      // 尝试购买过期的NFT
      await expect(
        marketplace.connect(buyer).buyNFT(newTokenId, { value: price })
      ).to.be.revertedWith("Listing has expired");
    });
  });

  describe("NFT Listing Cancellation", function () {
    beforeEach(async function () {
      await nft.connect(seller).approve(marketplace.address, tokenId);
      await marketplace.connect(seller).listNFT(tokenId, price);
    });

    it("Should cancel listing successfully", async function () {
      await marketplace.connect(seller).cancelListing(tokenId);

      expect(await nft.ownerOf(tokenId)).to.equal(seller.address);
      
      const listing = await marketplace.getListing(tokenId);
      expect(listing.isActive).to.be.false;
      
      // 检查看板是否已移除
      const boardListings = await marketplace.getBoardListings();
      expect(boardListings.length).to.equal(0);
    });

    it("Should fail to cancel listing if not seller", async function () {
      await expect(
        marketplace.connect(buyer).cancelListing(tokenId)
      ).to.be.revertedWith("Not the seller");
    });
  });

  describe("Asset Management", function () {
    beforeEach(async function () {
      // 铸造多个NFT
      await nft.connect(owner).mint(seller.address, tokenURI);
      await nft.connect(owner).mint(buyer.address, tokenURI);
      // seller拥有tokenId=1,2; buyer拥有tokenId=3
    });

    it("Should return correct asset owner", async function () {
      expect(await marketplace.getAssetOwner(1)).to.equal(seller.address);
      expect(await marketplace.getAssetOwner(2)).to.equal(seller.address);
      expect(await marketplace.getAssetOwner(3)).to.equal(buyer.address);
    });

    it("Should update user assets after buying", async function () {
      // 上架第一个NFT
      await nft.connect(seller).approve(marketplace.address, 1);
      await marketplace.connect(seller).listNFT(1, price);
      
      // 购买NFT
      await marketplace.connect(buyer).buyNFT(1, { value: price });
      
      // 查询买家资产
      const buyerAssets = await marketplace.getUserAssets(buyer.address);
      expect(buyerAssets.length).to.equal(1);
      expect(buyerAssets[0]).to.equal(1);
      
      // 验证所有者已更新
      expect(await marketplace.getAssetOwner(1)).to.equal(buyer.address);
    });

    it("Should get my assets correctly", async function () {
      // 上架并购买NFT
      await nft.connect(seller).approve(marketplace.address, 1);
      await marketplace.connect(seller).listNFT(1, price);
      await marketplace.connect(buyer).buyNFT(1, { value: price });
      
      // buyer拥有tokenId=1,3
      const myAssets = await marketplace.connect(buyer).getMyAssets();
      expect(myAssets.length).to.equal(2);
      expect(myAssets).to.include(1);
      expect(myAssets).to.include(3);
    });
  });

  describe("Auto Expiration", function () {
    it("Should allow manual processing of expired listings", async function () {
      // 铸造新NFT
      await nft.connect(owner).mint(seller.address, tokenURI);
      const newTokenId = 2;
      
      // 创建一个1区块后过期的上架
      await nft.connect(seller).approve(marketplace.address, newTokenId);
      await marketplace.connect(seller).listNFTWithExpiration(newTokenId, price, 1);
      
      // 进行一些交易，增加区块数
      await marketplace.connect(owner).setPlatformFee(200);
      await marketplace.connect(owner).setDefaultExpirationBlocks(600);
      
      // 处理过期的上架
      await marketplace.connect(buyer).processExpiredListings(5);
      
      // 验证上架已被取消
      const listing = await marketplace.getListing(newTokenId);
      expect(listing.isActive).to.be.false;
      
      // 验证NFT已返回给卖家
      expect(await nft.ownerOf(newTokenId)).to.equal(seller.address);
      
      // 验证看板已更新
      const boardListings = await marketplace.getBoardListings();
      expect(boardListings.length).to.equal(1); // 应该只剩下tokenId=1
      expect(boardListings[0]).to.equal(1);
    });

    it("Should handle board capacity limits", async function () {
      // 设置较小的容量
      await marketplace.connect(owner).setMaxBoardCapacity(2);
      
      // 铸造多个NFT并上架
      for (let i = 0; i < 3; i++) {
        await nft.connect(owner).mint(seller.address, tokenURI);
        const newTokenId = i + 2; // 从2开始
        await nft.connect(seller).approve(marketplace.address, newTokenId);
        await marketplace.connect(seller).listNFT(newTokenId, price);
      }
      
      // 看板容量应该保持在2
      const boardListings = await marketplace.getBoardListings();
      expect(boardListings.length).to.equal(2);
      
      // 第一个上架的应该被移除
      const listing = await marketplace.getListing(1);
      expect(listing.isActive).to.be.false;
    });
  });

  describe("Platform Settings", function () {
    it("Should allow owner to change platform fee", async function () {
      const newFee = 300; // 3%
      await marketplace.connect(owner).setPlatformFee(newFee);
      expect(await marketplace.platformFee()).to.equal(newFee);
    });

    it("Should allow owner to change default expiration blocks", async function () {
      const newBlocks = 1000;
      await marketplace.connect(owner).setDefaultExpirationBlocks(newBlocks);
      expect(await marketplace.defaultExpirationBlocks()).to.equal(newBlocks);
    });

    it("Should allow owner to change max board capacity", async function () {
      const newCapacity = 50;
      await marketplace.connect(owner).setMaxBoardCapacity(newCapacity);
      expect(await marketplace.maxBoardCapacity()).to.equal(newCapacity);
    });

    it("Should fail to change settings if not owner", async function () {
      await expect(
        marketplace.connect(seller).setPlatformFee(300)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      await expect(
        marketplace.connect(seller).setDefaultExpirationBlocks(1000)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      await expect(
        marketplace.connect(seller).setMaxBoardCapacity(50)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
}); 