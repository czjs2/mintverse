const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("NFT Marketplace", function () {
  let NFT;
  let nft;
  let NFTMarketplace;
  let marketplace;
  let owner;
  let seller;
  let buyer;
  let addrs;

  beforeEach(async function () {
    // 获取合约工厂
    NFT = await ethers.getContractFactory("NFT");
    NFTMarketplace = await ethers.getContractFactory("NFTMarketplace");
    
    // 获取签名者
    [owner, seller, buyer, ...addrs] = await ethers.getSigners();

    // 部署 NFT 合约
    nft = await upgrades.deployProxy(NFT, [], { initializer: 'initialize' });
    await nft.waitForDeployment();

    // 部署 NFTMarketplace 合约
    marketplace = await upgrades.deployProxy(NFTMarketplace, [await nft.getAddress()], { initializer: 'initialize' });
    await marketplace.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await marketplace.owner()).to.equal(await owner.getAddress());
    });

    it("Should set the correct NFT contract address", async function () {
      expect(await marketplace.nftContract()).to.equal(await nft.getAddress());
    });
  });

  describe("Listing", function () {
    const tokenId = 1;
    const price = ethers.parseEther("1.0");
    const tokenURI = "ipfs://test-uri";

    beforeEach(async function () {
      // 铸造 NFT 给卖家
      await nft.mint(seller.address, tokenURI);
      // 卖家授权市场合约
      await nft.connect(seller).approve(await marketplace.getAddress(), tokenId);
    });

    it("Should list NFT successfully", async function () {
      await marketplace.connect(seller).listNFT(tokenId, price);
      const listing = await marketplace.listings(tokenId);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(price);
      expect(listing.isActive).to.be.true;
    });

    it("Should fail to list if not token owner", async function () {
      await expect(
        marketplace.connect(buyer).listNFT(tokenId, price)
      ).to.be.rejectedWith("Not token owner");
    });

    it("Should fail to list if price is zero", async function () {
      await expect(
        marketplace.connect(seller).listNFT(tokenId, 0)
      ).to.be.rejectedWith("Price must be greater than 0");
    });
  });

  describe("Buying", function () {
    const tokenId = 1;
    const price = ethers.parseEther("1.0");
    const tokenURI = "ipfs://test-uri";

    beforeEach(async function () {
      // 铸造 NFT 给卖家
      await nft.mint(seller.address, tokenURI);
      // 卖家授权市场合约
      await nft.connect(seller).approve(await marketplace.getAddress(), tokenId);
      // 卖家上架 NFT
      await marketplace.connect(seller).listNFT(tokenId, price);
    });

    it("Should buy NFT successfully", async function () {
      const initialSellerBalance = await ethers.provider.getBalance(seller.address);
      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);

      await marketplace.connect(buyer).buyNFT(tokenId, { value: price });

      // 检查 NFT 所有权转移
      expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);
      
      // 检查上架状态
      const listing = await marketplace.listings(tokenId);
      expect(listing.isActive).to.be.false;

      // 检查余额变化
      const finalSellerBalance = await ethers.provider.getBalance(seller.address);
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      
      const sellerProfit = finalSellerBalance - initialSellerBalance;
      const ownerProfit = finalOwnerBalance - initialOwnerBalance;
      
      expect(sellerProfit).to.equal(price * BigInt(95) / BigInt(100)); // 95% 给卖家
      expect(ownerProfit).to.equal(price * BigInt(5) / BigInt(100));   // 5% 给平台
    });

    it("Should fail to buy if not listed", async function () {
      await marketplace.connect(seller).cancelListing(tokenId);
      await expect(
        marketplace.connect(buyer).buyNFT(tokenId, { value: price })
      ).to.be.rejectedWith("NFT not listed");
    });

    it("Should fail to buy if price is incorrect", async function () {
      await expect(
        marketplace.connect(buyer).buyNFT(tokenId, { value: price * BigInt(2) })
      ).to.be.rejectedWith("Incorrect price");
    });
  });

  describe("Cancellation", function () {
    const tokenId = 1;
    const price = ethers.parseEther("1.0");
    const tokenURI = "ipfs://test-uri";

    beforeEach(async function () {
      await nft.mint(seller.address, tokenURI);
      await nft.connect(seller).approve(await marketplace.getAddress(), tokenId);
      await marketplace.connect(seller).listNFT(tokenId, price);
    });

    it("Should cancel listing successfully", async function () {
      await marketplace.connect(seller).cancelListing(tokenId);
      const listing = await marketplace.listings(tokenId);
      expect(listing.isActive).to.be.false;
    });

    it("Should fail to cancel if not seller", async function () {
      await expect(
        marketplace.connect(buyer).cancelListing(tokenId)
      ).to.be.rejectedWith("Not the seller");
    });
  });

  describe("Price Updates", function () {
    const tokenId = 1;
    const initialPrice = ethers.parseEther("1.0");
    const newPrice = ethers.parseEther("2.0");
    const tokenURI = "ipfs://test-uri";

    beforeEach(async function () {
      await nft.mint(seller.address, tokenURI);
      await nft.connect(seller).approve(await marketplace.getAddress(), tokenId);
      await marketplace.connect(seller).listNFT(tokenId, initialPrice);
    });

    it("Should update price successfully", async function () {
      await marketplace.connect(seller).updatePrice(tokenId, newPrice);
      const listing = await marketplace.listings(tokenId);
      expect(listing.price).to.equal(newPrice);
    });

    it("Should fail to update price if not seller", async function () {
      await expect(
        marketplace.connect(buyer).updatePrice(tokenId, newPrice)
      ).to.be.rejectedWith("Not the seller");
    });

    it("Should fail to update price if new price is zero", async function () {
      await expect(
        marketplace.connect(seller).updatePrice(tokenId, 0)
      ).to.be.rejectedWith("Price must be greater than 0");
    });
  });

  describe("User Assets", function () {
    const tokenId1 = 1;
    const tokenId2 = 2;
    const price = ethers.parseEther("1.0");
    const tokenURI = "ipfs://test-uri";

    beforeEach(async function () {
      // 铸造两个 NFT 给卖家
      await nft.mint(seller.address, tokenURI);
      await nft.mint(seller.address, tokenURI);
      // 卖家授权市场合约
      await nft.connect(seller).approve(await marketplace.getAddress(), tokenId1);
      await nft.connect(seller).approve(await marketplace.getAddress(), tokenId2);
      // 卖家上架 NFT
      await marketplace.connect(seller).listNFT(tokenId1, price);
      await marketplace.connect(seller).listNFT(tokenId2, price);
    });

    it("Should return correct user assets", async function () {
      const assets = await marketplace.getUserAssets(seller.address);
      expect(assets.length).to.equal(2);
      expect(assets[0]).to.equal(BigInt(tokenId1));
      expect(assets[1]).to.equal(BigInt(tokenId2));
    });

    it("Should return empty array for user with no assets", async function () {
      const assets = await marketplace.getUserAssets(buyer.address);
      expect(assets.length).to.equal(0);
    });
  });

  describe("Asset Ownership", function () {
    const tokenId = 1;
    const price = ethers.parseEther("1.0");
    const tokenURI = "ipfs://test-uri";

    beforeEach(async function () {
      await nft.mint(seller.address, tokenURI);
      await nft.connect(seller).approve(await marketplace.getAddress(), tokenId);
      await marketplace.connect(seller).listNFT(tokenId, price);
    });

    it("Should return correct asset ownership", async function () {
      const isOwner = await marketplace.isAssetOwner(seller.address, tokenId);
      expect(isOwner).to.be.true;
    });

    it("Should return false for non-owner", async function () {
      const isOwner = await marketplace.isAssetOwner(buyer.address, tokenId);
      expect(isOwner).to.be.false;
    });
  });

  describe("Auto Delisting", function () {
    const tokenId = 1;
    const price = ethers.parseEther("1.0");
    const tokenURI = "ipfs://test-uri";
    const listingDuration = 7 * 24 * 60 * 60; // 7 days in seconds

    beforeEach(async function () {
      await nft.mint(seller.address, tokenURI);
      await nft.connect(seller).approve(await marketplace.getAddress(), tokenId);
      await marketplace.connect(seller).listNFTWithExpiration(tokenId, price, listingDuration);
    });

    it("Should auto delist after duration", async function () {
      // 快进时间到超过上架期限
      await ethers.provider.send("evm_increaseTime", [listingDuration + 1]);
      await ethers.provider.send("evm_mine");

      // 尝试购买应该失败
      await expect(
        marketplace.connect(buyer).buyNFT(tokenId, { value: price })
      ).to.be.rejectedWith("Listing has expired");
    });

    it("Should not auto delist before duration", async function () {
      // 快进时间到接近但未超过上架期限
      await ethers.provider.send("evm_increaseTime", [listingDuration - 60]); // 提前1分钟
      await ethers.provider.send("evm_mine");

      // 应该仍然可以购买
      await marketplace.connect(buyer).buyNFT(tokenId, { value: price });
      expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);
    });
  });
}); 