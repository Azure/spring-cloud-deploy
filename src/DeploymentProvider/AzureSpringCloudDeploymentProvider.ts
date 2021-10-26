import * as core from '@actions/core';
import { v4 as uuidv4 } from 'uuid';
import { Package, PackageType } from 'azure-actions-utility/packageUtility';
import { Actions, TaskParameters, TaskParametersUtility } from '../operations/taskparameters';
import { AppPlatformManagementClient, AppPlatformManagementModels as Models } from '@azure/arm-appplatform'
import { getDefaultAzureCredential } from '@azure/identity'
import { DeploymentHelper as dh } from "./DeploymentHelper";
import tar = require('tar');

export class AzureSpringCloudDeploymentProvider {

    defaultInactiveDeploymentName = 'staging';

    protected params: TaskParameters;
    protected client: AppPlatformManagementClient;

    constructor() {
        this.params = TaskParametersUtility.getParameters();
    }

    public async PreDeploymentStep() {
        const token = getDefaultAzureCredential();
        this.client = new AppPlatformManagementClient(token, this.params.AzureSubscription);
        const serviceList = await this.client.services.listBySubscription();
        let filteredResources: Array<Models.ServiceResource> = [];
        serviceList.forEach(service => {
            if(service.name == this.params.ServiceName) {
                filteredResources.push(service);
            }
        });
        if (!filteredResources || filteredResources.length == 0) {
            throw new Error('ResourceDoesntExist' + this.params.ServiceName);
        }
        else if (filteredResources.length == 1) {
            core.debug("filteredResources:\n" + JSON.stringify(filteredResources));
            core.debug("id:\n" + filteredResources[0].id);
            const beginStr = '/resourceGroups/';
            const endStr = '/providers/Microsoft.AppPlatform/Spring'
            const beginIndex = filteredResources[0].id.indexOf(beginStr) + beginStr.length;
            const endIndex = filteredResources[0].id.indexOf(endStr);
            if (beginIndex == -1 || endIndex == -1 || beginIndex >= endIndex) {
                core.debug('ResourceGroupNameParseErrorWithId:' + filteredResources[0].id);
                throw new Error('ResourceGroupNameParseError');
            }
            this.params.ResourceGroupName = filteredResources[0].id.substring(beginIndex, endIndex);
            core.debug("ResourceGroupName:\n" + this.params.ResourceGroupName);
        }
        else { //Should never ever ever happen
            throw new Error('DuplicateAzureSpringCloudName');
        }
        const serviceResponse = await this.client.services.get(this.params.ResourceGroupName, this.params.ServiceName);
        core.debug("service response:\n" + serviceResponse._response.bodyAsText);
    }

    public async DeployAppStep() {
        switch (this.params.Action) {

            case Actions.deploy: {
                await this.performDeployAction();
                break;
            }

            case Actions.setProduction: {
                await this.performSetProductionAction();
                break;
            }

            case Actions.deleteStagingDeployment: {
                await this.performDeleteStagingDeploymentAction();
                break;
            }

            default:
                throw Error('UnknownOrUnsupportedAction' + this.params.Action);
        }
    }

    private async performDeleteStagingDeploymentAction() {
        core.debug('Delete staging deployment action');
        const deploymentName = await dh.getStagingDeploymentName(this.client, this.params);
        if (deploymentName) {
            await this.client.deployments.deleteMethod(this.params.ResourceGroupName, this.params.ServiceName, this.params.AppName, deploymentName);
        } else {
            throw Error('NoStagingDeploymentFound');
        }
        return deploymentName;
    }

    private async performSetProductionAction() {
        core.debug('Set production action for app ' + this.params.AppName);
        let deploymentName: string;
        if (this.params.UseStagingDeployment) {
            core.debug('Targeting inactive deployment');
            deploymentName = await dh.getStagingDeploymentName(this.client, this.params);
            this.params.DeploymentName = deploymentName;
            if (!deploymentName) { //If no inactive deployment exists, we cannot continue as instructed.
                throw Error('NoStagingDeploymentFound');
            }
        }
        else {
            //Verify that the named deployment actually exists.
            deploymentName = this.params.DeploymentName;
            let existingStagingDeploymentName: string = await dh.getStagingDeploymentName(this.client, this.params);
            if (deploymentName != existingStagingDeploymentName) {
                throw Error('StagingDeploymentWithNameDoesntExist' + deploymentName);
            }
        }

        await dh.setActiveDeployment(this.client, this.params);
    }

    private async performDeployAction() {
        core.debug('Deployment action');

        let sourceType: string = this.determineSourceType(this.params.Package);

        //If uploading a source folder, compress to tar.gz file.
        let fileToUpload: string = sourceType == SourceType.SOURCE_DIRECTORY ?
            await this.compressSourceDirectory(this.params.Package.getPath()) :
            this.params.Package.getPath();


        let deploymentName: string;
        if (this.params.UseStagingDeployment) {
            deploymentName = await dh.getStagingDeploymentName(this.client, this.params);

            if (!deploymentName) { //If no inactive deployment exists
                core.debug('No inactive deployment exists');
                if (this.params.CreateNewDeployment) {
                    core.debug('New deployment will be created');
                    deploymentName = this.defaultInactiveDeploymentName; //Create a new deployment with the default name.
                    this.params.DeploymentName = deploymentName;
                } else
                    throw Error('NoStagingDeploymentFound');
            }
        } else { //Deploy to deployment with specified name
            core.debug('Deploying with specified name.');
            deploymentName = this.params.DeploymentName;
            let deploymentNames : Array<string> = await dh.getAllDeploymentsName(this.client, this.params);
            if (!deploymentNames || !deploymentNames.includes(deploymentName)) {
                core.debug(`Deployment ${deploymentName} does not exist`);
                if (this.params.CreateNewDeployment) {
                    if (deploymentNames.length > 1) {
                        throw Error('TwoDeploymentsAlreadyExistCannotCreate' + deploymentName);
                    } else {
                        core.debug('Deployment will be created.');
                    }
                } else {
                    throw Error('DeploymentDoesntExist' + deploymentName);
                }

            }
        }
        try {
            await dh.deploy(this.client, this.params, sourceType, fileToUpload);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Compresses sourceDirectoryPath into a tar.gz
     * @param sourceDirectoryPath 
     */
    async compressSourceDirectory(sourceDirectoryPath: string): Promise<string> {
        const fileName = `${uuidv4()}.tar.gz`;
        console.log('CompressingSourceDirectory', sourceDirectoryPath, fileName);
        await tar.c({
            gzip: true,
            file: fileName,
            sync: true,
            cwd: sourceDirectoryPath,
            onWarn: warning => {
                console.warn(warning);
            }
        }, ['.']);
        return fileName;
    }

    private determineSourceType(pkg: Package): string {
        var sourceType: string;
        switch (pkg.getPackageType()) {
            case PackageType.folder:
                sourceType = SourceType.SOURCE_DIRECTORY;
                break;
            case PackageType.zip:
                sourceType = SourceType.DOT_NET_CORE_ZIP;
                break;
            case PackageType.jar:
                sourceType = SourceType.JAR;
                break;
            default:
                throw Error('UnsupportedSourceType' + pkg.getPath());
        }
        return sourceType;
    }
}

export const SourceType = {
    JAR: "Jar",
    SOURCE_DIRECTORY: "Source",
    DOT_NET_CORE_ZIP: "NetCoreZip"
}