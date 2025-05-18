import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("NFT Contract", function () {
  let nft: Contract;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const NFT = await ethers.getContractFactory("NFT");
    nft = await upgrades.deployProxy(NFT, [], { initializer: 'initialize' });
    await nft.waitForDeployment();
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
    it("Should mint a new NFT with correct tokenURI", async function () {
      const tokenURI = "ipfs://QmTest123";
      
      await expect(nft.mint(addr1.address, tokenURI))
        .to.emit(nft, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, 1);

      expect(await nft.ownerOf(1)).to.equal(addr1.address);
      expect(await nft.tokenURI(1)).to.equal(tokenURI);
    });

    it("Should increment token IDs correctly", async function () {
      await nft.mint(addr1.address, "ipfs://QmTest1");
      await nft.mint(addr2.address, "ipfs://QmTest2");

      expect(await nft.ownerOf(1)).to.equal(addr1.address);
      expect(await nft.ownerOf(2)).to.equal(addr2.address);
    });

    it("Should fail when querying non-existent token", async function () {
      await expect(nft.tokenURI(999))
        .to.be.revertedWith("URI query for nonexistent token");
    });
  });
}); 