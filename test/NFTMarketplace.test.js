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
  });

  describe("NFT Listing", function () {
    it("Should list NFT successfully", async function () {
      await nft.connect(seller).approve(marketplace.address, tokenId);
      await marketplace.connect(seller).listNFT(tokenId, price);

      const listing = await marketplace.getListing(tokenId);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(price);
      expect(listing.isActive).to.be.true;
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

      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      // 验证卖家收到的金额（减去平台费用）
      const platformFee = price * 200n / 10000n; // 2% 平台费用
      const sellerAmount = price - platformFee;
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(sellerAmount);

      // 验证平台收到的费用
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(platformFee);
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
    });

    it("Should fail to cancel listing if not seller", async function () {
      await expect(
        marketplace.connect(buyer).cancelListing(tokenId)
      ).to.be.revertedWith("Not the seller");
    });
  });

  describe("Platform Fee", function () {
    it("Should allow owner to change platform fee", async function () {
      const newFee = 300; // 3%
      await marketplace.connect(owner).setPlatformFee(newFee);
      expect(await marketplace.platformFee()).to.equal(newFee);
    });

    it("Should fail to change platform fee if not owner", async function () {
      await expect(
        marketplace.connect(seller).setPlatformFee(300)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail to set platform fee too high", async function () {
      await expect(
        marketplace.connect(owner).setPlatformFee(1001)
      ).to.be.revertedWith("Fee too high");
    });
  });
}); 