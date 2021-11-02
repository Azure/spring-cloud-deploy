import { Actions, ActionParameters } from '../operations/actionParameters';
import { AppPlatformManagementClient, AppPlatformManagementModels as Models } from '@azure/arm-appplatform'
import { uploadFileToSasUrl } from "./azure-storage";
import * as core from "@actions/core";
import { parse } from 'azure-actions-utility/parameterParserUtility';

export class DeploymentHelper {

    private static readonly SUCCESS_CODE: Array<number> = [200, 201, 202];

    public static async getStagingDeploymentName(client: AppPlatformManagementClient, params: ActionParameters): Promise<string> {
        const deployments: Models.DeploymentsListResponse = await client.deployments.list(params.ResourceGroupName, params.ServiceName, params.AppName);
        core.debug('list deployments response: ' + deployments._response.bodyAsText);
        if (!this.SUCCESS_CODE.includes(deployments._response.status)) {
            throw Error('ListDeploymentsError');
        }
        let ret: string;
        deployments.forEach(deployment => {
            core.debug('deployment str: ' + JSON.stringify(deployment));
            if (deployment.properties.active == false) {
                core.debug("inactive deployment name: " + deployment.name);
                ret = deployment.name;
            } else {
                core.debug("active deployment name: " + deployment.name);
            }
        });
        return ret;
    }

    public static async getAllDeploymentsName(client: AppPlatformManagementClient, params: ActionParameters): Promise<Array<string>> {
        let names: Array<string> = [];
        const deployments: Models.DeploymentsListResponse = await client.deployments.list(params.ResourceGroupName, params.ServiceName, params.AppName);
        core.debug('list deployments response: ' + deployments._response.bodyAsText);
        if (!this.SUCCESS_CODE.includes(deployments._response.status)) {
            throw Error('ListDeploymentsError');
        }
        deployments.forEach(deployment => {
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
        const updateResponse: Models.AppsUpdateResponse = await client.apps.update(params.ResourceGroupName, params.ServiceName, params.AppName, appResource);
        core.debug('set active deployment response: ' + updateResponse._response.bodyAsText);
        if (!this.SUCCESS_CODE.includes(updateResponse._response.status)) {
            throw Error('SetActiveDeploymentError');
        }
        return;
    }

    public static async deploy(client: AppPlatformManagementClient, params: ActionParameters, sourceType: string, fileToUpload: string) {
        let uploadResponse: Models.AppsGetResourceUploadUrlResponse = await client.apps.getResourceUploadUrl(params.ResourceGroupName, params.ServiceName, params.AppName);
        core.debug('request upload url response: ' + uploadResponse._response.bodyAsText);
        if (uploadResponse._response.status in this.SUCCESS_CODE) {
            throw Error('RequestUploadUrlError');
        }
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
        core.debug("deploymentResource: " + JSON.stringify(deploymentResource));
        const response = await client.deployments.createOrUpdate(params.ResourceGroupName, params.ServiceName, params.AppName, params.DeploymentName, deploymentResource);
        core.debug('deploy response: ' + response._response.bodyAsText);
        if (!this.SUCCESS_CODE.includes(response._response.status)) {
            throw Error('DeployError');
        }
        return;
    }

    public static async deleteDeployment(client: AppPlatformManagementClient, params: ActionParameters) {
        const response = await client.deployments.deleteMethod(params.ResourceGroupName, params.ServiceName, params.AppName, params.DeploymentName);
        core.debug('delete deployment response: ' + response._response.bodyAsText);
        if (!this.SUCCESS_CODE.includes(response._response.status)) {
            throw Error('DeleteDeploymentError');
        }
        return;
    }
}
