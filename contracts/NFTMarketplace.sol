// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NFT.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

contract NFTMarketplace is Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable, UUPSUpgradeable {
    NFT private nftContract;
    
    // 上架信息结构
    struct Listing {
        address seller;
        uint256 price;
        bool isActive;
    }
    
    // 平台费用比例（2%）
    uint256 public platformFee;
    uint256 public constant BASIS_POINTS = 10000;
    
    // 存储所有上架的NFT
    mapping(uint256 => Listing) public listings;
    
    // 事件定义
    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NFTSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event NFTListingCancelled(uint256 indexed tokenId, address indexed seller);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _nftContract) public initializer {
        __ReentrancyGuard_init();
        __Ownable_init();
        __UUPSUpgradeable_init();
        nftContract = NFT(_nftContract);
        platformFee = 200; // 2%
    }
    
    // NFT上架函数
    function listNFT(uint256 tokenId, uint256 price) external {
        require(nftContract.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(price > 0, "Price must be greater than 0");
        
        // 转移NFT到合约
        nftContract.transferFrom(msg.sender, address(this), tokenId);
        
        // 创建上架信息
        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            isActive: true
        });
        
        emit NFTListed(tokenId, msg.sender, price);
    }
    
    // 购买NFT函数
    function buyNFT(uint256 tokenId) external payable nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.isActive, "Listing is not active");
        require(msg.value >= listing.price, "Insufficient payment");
        
        // 计算平台费用
        uint256 platformFeeAmount = (listing.price * platformFee) / BASIS_POINTS;
        uint256 sellerAmount = listing.price - platformFeeAmount;
        
        // 转移NFT给买家
        nftContract.transferFrom(address(this), msg.sender, tokenId);
        
        // 转移资金
        payable(listing.seller).transfer(sellerAmount);
        payable(owner()).transfer(platformFeeAmount);
        
        // 更新上架状态
        listing.isActive = false;
        
        emit NFTSold(tokenId, listing.seller, msg.sender, listing.price);
    }
    
    // 取消上架函数
    function cancelListing(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        require(listing.seller == msg.sender, "Not the seller");
        require(listing.isActive, "Listing is not active");
        
        // 返还NFT给卖家
        nftContract.transferFrom(address(this), msg.sender, tokenId);
        
        // 更新上架状态
        listing.isActive = false;
        
        emit NFTListingCancelled(tokenId, msg.sender);
    }
    
    // 查看NFT上架信息
    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }
    
    // 修改平台费用比例（仅合约所有者可调用）
    function setPlatformFee(uint256 _platformFee) external onlyOwner {
        require(_platformFee <= 1000, "Fee too high"); // 最高10%
        platformFee = _platformFee;
    }

    // UUPS升级函数
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
} 