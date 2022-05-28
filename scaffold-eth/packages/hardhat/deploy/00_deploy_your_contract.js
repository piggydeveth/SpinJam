// deploy/00_deploy_your_contract.js

const { ethers } = require("hardhat");

const localChainId = "31337";

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  await deploy("SpinJamGIF", {
    // Learn more about args here: https://www.npmjs.com/package/hardhat-deploy#deploymentsdeploy
    from: deployer,
    args: [""],
    log: true,
    waitConfirmations: 5,
  });

  await deploy("SpinJamVRFv2Consumer", {
    // Learn more about args here: https://www.npmjs.com/package/hardhat-deploy#deploymentsdeploy
    from: deployer,
    args: [4550],
    log: true,
    waitConfirmations: 5,
  });
  const SpinJamVRFv2Consumer = await ethers.getContract(
    "SpinJamVRFv2Consumer",
    deployer
  );

  await deploy("SpinJamCoordinator", {
    // Learn more about args here: https://www.npmjs.com/package/hardhat-deploy#deploymentsdeploy
    from: deployer,
    args: [SpinJamVRFv2Consumer.address],
    log: true,
    waitConfirmations: 5,
  });

  // Getting a previously deployed contract
  const SpinJamCoordinator = await ethers.getContract(
    "SpinJamCoordinator",
    deployer
  );
  await SpinJamVRFv2Consumer.setOwner(SpinJamCoordinator.address);
};
module.exports.tags = [
  "SpinJamGIF",
  "SpinJamVRFv2Consumer",
  "SpinJamCoordinator",
];
