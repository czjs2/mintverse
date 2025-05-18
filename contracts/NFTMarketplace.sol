// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "contracts/NFT.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

contract NFTMarketplace is Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable, UUPSUpgradeable {
    NFT public nftContract;
    
    // 上架信息结构
    struct Listing {
        address seller;
        uint256 price;
        bool isActive;
        uint256 listingBlock; // 上架区块
        uint256 expirationBlock; // 过期区块
    }
    
    // 平台费用比例（5%）
    uint256 public platformFee;
    uint256 public constant BASIS_POINTS = 10000;
    
    // 默认过期区块数量
    uint256 public defaultExpirationBlocks;
    // 看板最大容量
    uint256 public maxBoardCapacity;
    
    // 存储所有上架的NFT
    mapping(uint256 => Listing) public listings;
    // 存储用户拥有的NFT列表
    mapping(address => uint256[]) private userAssets;
    // 用户NFT索引映射（用于优化删除操作） 
    mapping(address => mapping(uint256 => uint256)) private userAssetIndices;
    // 看板上的NFT列表
    uint256[] public boardListings;
    
    // 事件定义
    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price, uint256 expirationBlocks);
    event NFTSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event NFTListingCancelled(uint256 indexed tokenId, address indexed seller);
    event NFTListingExpired(uint256 indexed tokenId, address indexed seller);
    event PriceUpdated(uint256 indexed tokenId, uint256 newPrice);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _nftContract) public initializer {
        __ReentrancyGuard_init();
        __Ownable_init();
        __UUPSUpgradeable_init();
        nftContract = NFT(_nftContract);
        platformFee = 500; // 5%
        defaultExpirationBlocks = 500; // 默认500个区块后过期
        maxBoardCapacity = 100; // 最大看板容量
    }
    
    // NFT上架函数
    function listNFT(uint256 tokenId, uint256 price) external {
        _listNFT(tokenId, price, defaultExpirationBlocks);
    }
    
    // 自定义过期时间的NFT上架函数
    function listNFTWithExpiration(uint256 tokenId, uint256 price, uint256 expirationBlocks) external {
        _listNFT(tokenId, price, expirationBlocks);
    }
    
    // 内部上架函数
    function _listNFT(uint256 tokenId, uint256 price, uint256 expirationBlocks) internal {
        require(nftContract.ownerOf(tokenId) == msg.sender, "Not token owner");
        require(price > 0, "Price must be greater than 0");
        
        // 转移NFT到合约
        nftContract.transferFrom(msg.sender, address(this), tokenId);
        
        // 创建上架信息
        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            isActive: true,
            listingBlock: block.number,
            expirationBlock: block.number + expirationBlocks
        });
        
        // 将NFT添加到用户资产列表
        _addToUserAssets(msg.sender, tokenId);
        // 将NFT添加到看板
        _addToBoard(tokenId);
        
        emit NFTListed(tokenId, msg.sender, price, expirationBlocks);
    }
    
    // 购买NFT函数
    function buyNFT(uint256 tokenId) external payable nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.isActive, "NFT not listed");
        require(block.number <= listing.expirationBlock, "Listing has expired");
        require(msg.value == listing.price, "Incorrect price");
        
        // 计算平台费用
        uint256 platformFeeAmount = (listing.price * platformFee) / BASIS_POINTS;
        uint256 sellerAmount = listing.price - platformFeeAmount;
        
        // 转移NFT给买家
        nftContract.transferFrom(address(this), msg.sender, tokenId);
        
        // 添加到买家资产列表
        _addToUserAssets(msg.sender, tokenId);
        
        // 从卖家资产列表中移除
        _removeFromUserAssets(listing.seller, tokenId);
        
        // 转移资金
        payable(listing.seller).transfer(sellerAmount);
        payable(owner()).transfer(platformFeeAmount);
        
        // 更新上架状态
        listing.isActive = false;
        
        // 从看板中移除
        _removeFromBoard(tokenId);
        
        // 处理过期的NFT
        _processExpiredListings();
        
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
        
        // 从看板中移除
        _removeFromBoard(tokenId);
        
        emit NFTListingCancelled(tokenId, msg.sender);
    }
    
    // 更新价格函数
    function updatePrice(uint256 tokenId, uint256 newPrice) external {
        Listing storage listing = listings[tokenId];
        require(listing.seller == msg.sender, "Not the seller");
        require(listing.isActive, "Listing is not active");
        require(newPrice > 0, "Price must be greater than 0");
        
        listing.price = newPrice;
        emit PriceUpdated(tokenId, newPrice);
    }
    
    // 处理过期的NFT上架
    function _processExpiredListings() internal {
        uint256 processCount = 0;
        uint256 maxToProcess = 5; // 限制每次处理的数量以避免gas过高
        
        for (uint256 i = 0; i < boardListings.length && processCount < maxToProcess; i++) {
            uint256 tokenId = boardListings[i];
            Listing storage listing = listings[tokenId];
            
            if (listing.isActive && block.number > listing.expirationBlock) {
                // 返还NFT给卖家
                nftContract.transferFrom(address(this), listing.seller, tokenId);
                
                // 更新上架状态
                listing.isActive = false;
                
                // 从看板中移除
                _removeFromBoard(tokenId);
                
                emit NFTListingExpired(tokenId, listing.seller);
                
                processCount++;
                // 因为我们删除了一个元素，所以需要减少索引
                i--;
            }
        }
    }
    
    // 手动清理过期的NFT上架（可由任何人调用）
    function processExpiredListings(uint256 maxToProcess) external {
        uint256 processCount = 0;
        
        for (uint256 i = 0; i < boardListings.length && processCount < maxToProcess; i++) {
            uint256 tokenId = boardListings[i];
            Listing storage listing = listings[tokenId];
            
            if (listing.isActive && block.number > listing.expirationBlock) {
                // 返还NFT给卖家
                nftContract.transferFrom(address(this), listing.seller, tokenId);
                
                // 更新上架状态
                listing.isActive = false;
                
                // 从看板中移除
                _removeFromBoard(tokenId);
                
                emit NFTListingExpired(tokenId, listing.seller);
                
                processCount++;
                // 因为我们删除了一个元素，所以需要减少索引
                i--;
            }
        }
    }
    
    // 添加到看板
    function _addToBoard(uint256 tokenId) internal {
        // 检查看板容量
        if (boardListings.length >= maxBoardCapacity) {
            // 如果超出容量，处理过期的NFT
            _processExpiredListings();
            // 如果仍然超出容量，则移除最早的一个
            if (boardListings.length >= maxBoardCapacity) {
                uint256 oldestTokenId = boardListings[0];
                Listing storage oldestListing = listings[oldestTokenId];
                
                // 返还NFT给卖家
                nftContract.transferFrom(address(this), oldestListing.seller, oldestTokenId);
                
                // 更新上架状态
                oldestListing.isActive = false;
                
                // 从看板中移除
                _removeFromBoard(oldestTokenId);
                
                emit NFTListingExpired(oldestTokenId, oldestListing.seller);
            }
        }
        
        // 添加到看板
        boardListings.push(tokenId);
    }
    
    // 从看板中移除
    function _removeFromBoard(uint256 tokenId) internal {
        for (uint256 i = 0; i < boardListings.length; i++) {
            if (boardListings[i] == tokenId) {
                // 将最后一个元素移到当前位置
                boardListings[i] = boardListings[boardListings.length - 1];
                // 移除最后一个元素
                boardListings.pop();
                break;
            }
        }
    }
    
    // 添加到用户资产列表
    function _addToUserAssets(address user, uint256 tokenId) internal {
        if (userAssets[user].length == 0) {
            userAssets[user] = new uint256[](0);
        }
        userAssets[user].push(tokenId);
        userAssetIndices[user][tokenId] = userAssets[user].length - 1;
    }
    
    // 从用户资产列表中移除
    function _removeFromUserAssets(address user, uint256 tokenId) internal {
        if (userAssets[user].length == 0) {
            return;
        }
        
        uint256 index = userAssetIndices[user][tokenId];
        uint256 lastIndex = userAssets[user].length - 1;
        
        if (index != lastIndex) {
            uint256 lastTokenId = userAssets[user][lastIndex];
            userAssets[user][index] = lastTokenId;
            userAssetIndices[user][lastTokenId] = index;
        }
        
        userAssets[user].pop();
        delete userAssetIndices[user][tokenId];
    }
    
    // 查看NFT上架信息
    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }
    
    // 查询我的资产（单个人的资产）
    function getMyAssets() external view returns (uint256[] memory) {
        return getUserAssets(msg.sender);
    }
    
    // 查询指定用户的资产
    function getUserAssets(address user) public view returns (uint256[] memory) {
        return userAssets[user];
    }
    
    // 查询资产所有者
    function isAssetOwner(address user, uint256 tokenId) external view returns (bool) {
        Listing storage listing = listings[tokenId];
        if (listing.isActive) {
            return listing.seller == user;
        }
        return nftContract.ownerOf(tokenId) == user;
    }
    
    // 获取看板上的所有NFT
    function getBoardListings() external view returns (uint256[] memory) {
        return boardListings;
    }
    
    // 修改平台费用比例（仅合约所有者可调用）
    function setPlatformFee(uint256 _platformFee) external onlyOwner {
        require(_platformFee <= 1000, "Fee too high"); // 最高10%
        platformFee = _platformFee;
    }
    
    // 修改默认过期区块数量
    function setDefaultExpirationBlocks(uint256 _blocks) external onlyOwner {
        defaultExpirationBlocks = _blocks;
    }
    
    // 修改看板最大容量
    function setMaxBoardCapacity(uint256 _capacity) external onlyOwner {
        maxBoardCapacity = _capacity;
    }

    // UUPS升级函数
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}