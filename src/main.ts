import * as core from '@actions/core';
import {AzureSpringCloudDeploymentProvider} from "./DeploymentProvider/AzureSpringCloudDeploymentProvider";

export async function main() {

  core.debug('Starting deployment task execution');
  let deploymentProvider = new AzureSpringCloudDeploymentProvider();
  core.debug("Pre-deployment Step Started");
  await deploymentProvider.PreDeploymentStep();
  core.debug("Deployment Step Started");
  await deploymentProvider.DeployAppStep();
}

main();
