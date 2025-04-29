const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("NFT Contract", function () {
  let nft;
  let owner;
  let user;
  let tokenId;
  const tokenURI = "ipfs://QmTest";

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // 部署NFT合约
    const NFT = await ethers.getContractFactory("NFT");
    nft = await upgrades.deployProxy(NFT, [], {
      initializer: "initialize",
    });
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await nft.owner()).to.equal(owner.address);
    });

    it("Should set the correct name and symbol", async function () {
      expect(await nft.name()).to.equal("NFTMarket");
      expect(await nft.symbol()).to.equal("NFTM");
    });
  });

  describe("Minting", function () {
    it("Should mint NFT successfully", async function () {
      await nft.connect(owner).mint(user.address, tokenURI);
      tokenId = 1;

      expect(await nft.ownerOf(tokenId)).to.equal(user.address);
      expect(await nft.tokenURI(tokenId)).to.equal(tokenURI);
    });

    it("Should increment token ID correctly", async function () {
      await nft.connect(owner).mint(user.address, tokenURI);
      await nft.connect(owner).mint(user.address, tokenURI);
      
      expect(await nft.ownerOf(1)).to.equal(user.address);
      expect(await nft.ownerOf(2)).to.equal(user.address);
    });
  });

  describe("Token URI", function () {
    beforeEach(async function () {
      await nft.connect(owner).mint(user.address, tokenURI);
      tokenId = 1;
    });

    it("Should return correct token URI", async function () {
      expect(await nft.tokenURI(tokenId)).to.equal(tokenURI);
    });

    it("Should fail to get URI for nonexistent token", async function () {
      await expect(nft.tokenURI(999)).to.be.revertedWith("URI query for nonexistent token");
    });
  });

  describe("Transfer", function () {
    beforeEach(async function () {
      await nft.connect(owner).mint(user.address, tokenURI);
      tokenId = 1;
    });

    it("Should transfer NFT successfully", async function () {
      await nft.connect(user).transferFrom(user.address, owner.address, tokenId);
      expect(await nft.ownerOf(tokenId)).to.equal(owner.address);
    });

    it("Should fail to transfer if not owner", async function () {
      await expect(
        nft.connect(owner).transferFrom(user.address, owner.address, tokenId)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");
    });
  });
}); 