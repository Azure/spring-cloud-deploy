import { Actions, TaskParameters } from '../operations/taskparameters';
import { AppPlatformManagementClient, AppPlatformManagementModels as Models } from '@azure/arm-appplatform'
import { uploadFileToSasUrl } from "./azure-storage";
import * as core from "@actions/core";
import { parse } from 'azure-actions-utility/parameterParserUtility';

export class DeploymentHelper {
    public static async getStagingDeploymentName(client: AppPlatformManagementClient, params: TaskParameters): Promise<string> {
        const deployments: Models.DeploymentsListResponse = await client.deployments.list(params.ResourceGroupName, params.ServiceName, params.AppName);
        let ret: string;
        deployments.forEach(deployment => {
            core.debug('deployment str: ' + JSON.stringify(deployment));
            if (deployment.properties.active == false) {
                core.debug("inactive deployment name:" + deployment.name);
                ret = deployment.name;
            } else {
                core.debug("active deployment name:" + deployment.name);
            }
        });
        // for (const deploymentAny in deployments) {
        //     const deployment = deploymentAny as Models.DeploymentResource;
        //     console.log("deploymentAny:" + deploymentAny);
        //     console.log("deployment:" + deployment);
        //     console.log('Task parameters: ' + JSON.stringify(deployment));
        //     if (deployment?.properties?.active == false) {
        //         return deployment.name;
        //     }
        // }
        return ret;
    }

    public static async getAllDeploymentsName(client: AppPlatformManagementClient, params: TaskParameters): Promise<Array<string>> {
        let names: Array<string> = [];
        const deployments: Models.DeploymentsListResponse = await client.deployments.list(params.ResourceGroupName, params.ServiceName, params.AppName);
        deployments.forEach(deployment => {
            console.log("deployment:" + deployment);
            console.log('deployment str: ' + JSON.stringify(deployment));
            names.push(deployment.name);
        });
        // for (const deploymentAny in deployments) {
        //     const deployment = deploymentAny as Models.DeploymentResource;
        //     names.push(deployment.name);
        // }
        return names;
    }

    public static async setActiveDeployment(client: AppPlatformManagementClient, params: TaskParameters) {
        let appResource: Models.AppResource = {
            properties: {
                activeDeploymentName: params.DeploymentName
            }
        };
        await client.apps.update(params.ResourceGroupName, params.ServiceName, params.AppName, appResource);
        return;
    }

    public static async deploy(client: AppPlatformManagementClient, params: TaskParameters, sourceType: string, fileToUpload: string) {
        let uploadResponse: Models.AppsGetResourceUploadUrlResponse = await client.apps.getResourceUploadUrl(params.ResourceGroupName, params.ServiceName, params.AppName);
        await uploadFileToSasUrl(uploadResponse.uploadUrl, fileToUpload);
        let transformedEnvironmentVariables = {};
        if (params.EnvironmentVariables) {
            core.debug("Environment variables modified.");
            const parsedEnvVariables = parse(params.EnvironmentVariables);
            //Parsed pairs come back as  {"key1":{"value":"val1"},"key2":{"value":"val2"}}
            Object.keys(parsedEnvVariables).forEach(key => {
                transformedEnvironmentVariables[key] = parsedEnvVariables[key]['value'];
            });
            core.debug('Environment Variables: ' + JSON.stringify(transformedEnvironmentVariables));
        }
        // todo trans envs
        // let envs : Array<string> = params.EnvironmentVariables.split(',');
        // let envVars = {};
        // for(let env in envs) {
        //     let index: number = env.indexOf(':');
        //     let key: string = env.substring(0, index);
        //     let value: string = env.substring(index+1);
        //     envVars[key] = value;
        // }
        let deploymentResource: Models.DeploymentResource = {
            properties: {
                source: {
                    relativePath: uploadResponse.relativePath,
                    type: sourceType as Models.UserSourceType,
                    version: params.Version
                },
                deploymentSettings: {
                    jvmOptions: params.JvmOptions,
                    netCoreMainEntryPath: params.DotNetCoreMainEntryPath,
                    runtimeVersion: params.RuntimeVersion as Models.RuntimeVersion,
                    environmentVariables: transformedEnvironmentVariables
                }
            }
        }
        core.debug("deploymentResource:" + JSON.stringify(deploymentResource));
        const response = await client.deployments.createOrUpdate(params.ResourceGroupName, params.ServiceName, params.AppName, params.DeploymentName, deploymentResource);
        core.debug("deployment response:\n" + response._response.bodyAsText);
        return;
    }

    // public static async getEndpoint(client: AppPlatformManagementClient, params: TaskParameters): Promise<string> {
    //     await client.deployments.get(params.ResourceGroupName, params.ServiceName, params.AppName, params.DeploymentName).
    // }

}