import { Actions, ActionParameters } from '../operations/actionParameters';
import { AppPlatformManagementClient, AppPlatformManagementModels as Models } from '@azure/arm-appplatform'
import { uploadFileToSasUrl } from "./azure-storage";
import * as core from "@actions/core";
import { parse } from 'azure-actions-utility/parameterParserUtility';

export class DeploymentHelper {
    public static async getStagingDeploymentName(client: AppPlatformManagementClient, params: ActionParameters): Promise<string> {
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
        return ret;
    }

    public static async getAllDeploymentsName(client: AppPlatformManagementClient, params: ActionParameters): Promise<Array<string>> {
        let names: Array<string> = [];
        const deployments: Models.DeploymentsListResponse = await client.deployments.list(params.ResourceGroupName, params.ServiceName, params.AppName);
        deployments.forEach(deployment => {
            console.log("deployment:" + deployment);
            console.log('deployment str: ' + JSON.stringify(deployment));
            names.push(deployment.name);
        });
        return names;
    }

    public static async setActiveDeployment(client: AppPlatformManagementClient, params: ActionParameters) {
        let appResource: Models.AppResource = {
            properties: {
                activeDeploymentName: params.DeploymentName
            }
        };
        await client.apps.update(params.ResourceGroupName, params.ServiceName, params.AppName, appResource);
        return;
    }

    public static async deploy(client: AppPlatformManagementClient, params: ActionParameters, sourceType: string, fileToUpload: string) {
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

    public static async deleteDeployment(client: AppPlatformManagementClient, params: ActionParameters) {
        await client.deployments.deleteMethod(params.ResourceGroupName, params.ServiceName, params.AppName, params.DeploymentName);
        return;
    }
}