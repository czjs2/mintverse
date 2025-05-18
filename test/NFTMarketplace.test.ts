import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract, ContractTransactionResponse } from "ethers";
import { NFT, NFTMarketplace } from "../typechain-types";

describe("NFTMarketplace Contract", function () {
  let nft: NFT;
  let marketplace: NFTMarketplace;
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;
  let tokenId: number;
  const price = ethers.parseEther("1.0");

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();

    // 部署 NFT 合约
    const NFTFactory = await ethers.getContractFactory("NFT");
    nft = await upgrades.deployProxy(NFTFactory, [], { initializer: 'initialize' }) as NFT;
    await nft.waitForDeployment();

    // 部署 Marketplace 合约
    const MarketplaceFactory = await ethers.getContractFactory("NFTMarketplace");
    marketplace = await upgrades.deployProxy(MarketplaceFactory, [await nft.getAddress()], { initializer: 'initialize' }) as NFTMarketplace;
    await marketplace.waitForDeployment();

    // 铸造一个 NFT 给卖家
    await nft.mint(seller.address, "ipfs://QmTest123");
    tokenId = 1;

    // 卖家授权 marketplace 合约使用其 NFT
    await nft.connect(seller).approve(await marketplace.getAddress(), tokenId);
  });

  describe("Listing", function () {    it("Should list NFT successfully", async function () {
      await expect(marketplace.connect(seller).listNFT(tokenId, price))
        .to.emit(marketplace, "NFTListed")
        .withArgs(tokenId, seller.address, price, 500);

      const listing = await marketplace.getListing(tokenId);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(price);
      expect(listing.isActive).to.be.true;
    });

    it("Should fail when non-owner tries to list NFT", async function () {
      await expect(marketplace.connect(buyer).listNFT(tokenId, price))
        .to.be.revertedWith("Not token owner");
    });
  });

  describe("Buying", function () {
    beforeEach(async function () {
      await marketplace.connect(seller).listNFT(tokenId, price);
    });

    it("Should buy NFT successfully", async function () {
      const initialSellerBalance = await ethers.provider.getBalance(seller.address);
      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);

      await expect(marketplace.connect(buyer).buyNFT(tokenId, { value: price }))
        .to.emit(marketplace, "NFTSold")
        .withArgs(tokenId, seller.address, buyer.address, price);

      expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);
      
      // 验证资金转移
      const finalSellerBalance = await ethers.provider.getBalance(seller.address);
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      
      // 卖家应该收到 95% 的价格（扣除 5% 平台费用）
      expect(finalSellerBalance - initialSellerBalance).to.equal(price * BigInt(95) / BigInt(100));
      // 平台应该收到 5% 的费用
      expect(finalOwnerBalance - initialOwnerBalance).to.equal(price * BigInt(5) / BigInt(100));
    });

    it("Should fail when sending incorrect price", async function () {
      await expect(marketplace.connect(buyer).buyNFT(tokenId, { value: price + BigInt(1) }))
        .to.be.revertedWith("Incorrect price");
    });
  });

  describe("Cancellation", function () {
    beforeEach(async function () {
      await marketplace.connect(seller).listNFT(tokenId, price);
    });

    it("Should cancel listing successfully", async function () {
      await expect(marketplace.connect(seller).cancelListing(tokenId))
        .to.emit(marketplace, "NFTListingCancelled")
        .withArgs(tokenId, seller.address);

      const listing = await marketplace.getListing(tokenId);
      expect(listing.isActive).to.be.false;
      expect(await nft.ownerOf(tokenId)).to.equal(seller.address);
    });

    it("Should fail when non-seller tries to cancel listing", async function () {
      await expect(marketplace.connect(buyer).cancelListing(tokenId))
        .to.be.revertedWith("Not the seller");
    });
  });
});