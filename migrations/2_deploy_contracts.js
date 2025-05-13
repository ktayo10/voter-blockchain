const VoterRegistry = artifacts.require("./VoterRegistry.sol");
const Election = artifacts.require("./Election.sol");
const ElectionFactory = artifacts.require("./ElectionFactory.sol");

module.exports = async function(deployer) {
  // Deploy VoterRegistry first
  await deployer.deploy(VoterRegistry);
  const voterRegistry = await VoterRegistry.deployed();
  
  // Deploy ElectionFactory with VoterRegistry address
  await deployer.deploy(ElectionFactory, voterRegistry.address);
  
  // Deploy a sample election for backward compatibility
  await deployer.deploy(Election, "Sample Election", "A sample election for testing purposes");
};
