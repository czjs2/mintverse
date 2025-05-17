import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import "@openzeppelin/hardhat-upgrades";
import { upgrades } from "hardhat";
import { network } from "hardhat";

describe("NFT Contract", function () {
  let NFT: any;
  let nft: any;
  let owner: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;
  let addrs: HardhatEthersSigner[];

  beforeEach(async function () {
    // 重置网络状态，确保每个测试有干净的环境
    await network.provider.send("hardhat_reset");
    
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
      await nft.mint(await addr1.getAddress(), "ipfs://test-uri");
      expect(await nft.ownerOf(1)).to.equal(await addr1.getAddress());
    });

    it("Should increment token ID correctly", async function () {
      await nft.mint(await addr1.getAddress(), "ipfs://test-uri-1");
      await nft.mint(await addr1.getAddress(), "ipfs://test-uri-2");
      expect(await nft.ownerOf(1)).to.equal(await addr1.getAddress());
      expect(await nft.ownerOf(2)).to.equal(await addr1.getAddress());
    });
  });

  describe("Token URI", function () {
    it("Should return correct token URI", async function () {
      const tokenURI = "ipfs://test-uri";
      await nft.mint(await addr1.getAddress(), tokenURI);
      expect(await nft.tokenURI(1)).to.equal(tokenURI);
    });

    it("Should fail to get URI for nonexistent token", async function () {
      await expect(nft.tokenURI(999)).to.be.revertedWith("URI query for nonexistent token");
    });
  });

  describe("Transfer", function () {
    it("Should transfer NFT successfully", async function () {
      const ownerAddress = await owner.getAddress();
      const addr1Address = await addr1.getAddress();
      
      await nft.mint(ownerAddress, "ipfs://test-uri");
      await nft.transferFrom(ownerAddress, addr1Address, 1);
      expect(await nft.ownerOf(1)).to.equal(addr1Address);
    });

    it("Should fail to transfer if not owner", async function () {
      const ownerAddress = await owner.getAddress();
      const addr1Address = await addr1.getAddress();
      const addr2Address = await addr2.getAddress();
      
      await nft.mint(ownerAddress, "ipfs://test-uri");
      await expect(
        nft.connect(addr1).transferFrom(ownerAddress, addr2Address, 1)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");
    });
  });
}); 