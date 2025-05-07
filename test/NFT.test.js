const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("NFT Contract", function () {
  let NFT;
  let nft;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    // 获取合约工厂
    NFT = await ethers.getContractFactory("NFT");
    // 获取签名者
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    // 部署合约
    nft = await upgrades.deployProxy(NFT, [], { initializer: 'initialize' });
    await nft.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await nft.owner()).to.equal(await owner.getAddress());
    });
  });

  describe("Minting", function () {
    it("Should mint NFT successfully", async function () {
      await nft.mint(addr1.address, "ipfs://test-uri");
      expect(await nft.ownerOf(1)).to.equal(addr1.address);
    });

    it("Should increment token ID correctly", async function () {
      await nft.mint(addr1.address, "ipfs://test-uri-1");
      await nft.mint(addr1.address, "ipfs://test-uri-2");
      expect(await nft.ownerOf(1)).to.equal(addr1.address);
      expect(await nft.ownerOf(2)).to.equal(addr1.address);
    });
  });

  describe("Token URI", function () {
    it("Should return correct token URI", async function () {
      const tokenURI = "ipfs://test-uri";
      await nft.mint(addr1.address, tokenURI);
      expect(await nft.tokenURI(1)).to.equal(tokenURI);
    });

    it("Should fail to get URI for nonexistent token", async function () {
      await expect(nft.tokenURI(999)).to.be.rejectedWith("URI query for nonexistent token");
    });
  });

  describe("Transfer", function () {
    it("Should transfer NFT successfully", async function () {
      await nft.mint(owner.address, "ipfs://test-uri");
      await nft.transferFrom(owner.address, addr1.address, 1);
      expect(await nft.ownerOf(1)).to.equal(addr1.address);
    });

    it("Should fail to transfer if not owner", async function () {
      await nft.mint(owner.address, "ipfs://test-uri");
      await expect(
        nft.connect(addr1).transferFrom(owner.address, addr2.address, 1)
      ).to.be.rejectedWith("ERC721: caller is not token owner or approved");
    });
  });
}); 