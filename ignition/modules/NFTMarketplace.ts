const { buildModule } = require('@nomicfoundation/hardhat-ignition/modules');

module.exports = buildModule('NFTMarketplaceModule', (m:any) => {
  const storage = m.contract('NFTMarketplace');

  return { storage };
});