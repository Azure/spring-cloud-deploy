import * as core from '@actions/core';
import { Package, PackageType } from 'azure-actions-utility/packageUtility';

export class Inputs {
    public static readonly azureSubscription = 'azure-subscription';
    public static readonly resourceGroupName = 'resource-group-name';
    public static readonly serviceName = 'service-name';
    public static readonly action = 'action';
    public static readonly appName = 'app-name';
    public static readonly useStagingDeployment = 'use-staging-deployment';
    public static readonly createNewDeployment = 'create-new-deployment';
    public static readonly deploymentName = 'deployment-name';
    public static readonly environmentVariables = 'environment-variables';
    public static readonly jvmOptions = 'jvm-options'
    public static readonly runtimeVersion = 'runtime-version';
    public static readonly dotNetCoreMainEntryPath = 'dotnetcore-mainentry-path';
    public static readonly version = 'version';
    public static readonly package = 'package';
}

export class Actions {
    public static readonly deploy = 'Deploy';
    public static readonly setProduction = 'Set Production';
    public static readonly deleteStagingDeployment = 'Delete Staging Deployment';
}

export class TaskParametersUtility {
    public static getParameters(): TaskParameters {
        console.log('Started getParameters');
        var taskParameters: TaskParameters = {
            AzureSubscription: core.getInput(Inputs.azureSubscription, {"required": true}),
            //ResourceGroupName: core.getInput(Inputs.resourceGroupName, {"required":true}),
            ServiceName: core.getInput(Inputs.serviceName, {"required": true}),
            Action: core.getInput(Inputs.action, {"required": true}),
            AppName: core.getInput(Inputs.appName, {"required": true}),
            UseStagingDeployment: core.getInput(Inputs.useStagingDeployment, {"required": true}).toLowerCase() == "true",
            CreateNewDeployment: core.getInput(Inputs.createNewDeployment, {"required": false}).toLowerCase() == "true",
            DeploymentName: core.getInput(Inputs.deploymentName, {"required": !(core.getInput(Inputs.useStagingDeployment, {"required": true}).toLowerCase() == "true")}),
            EnvironmentVariables: core.getInput(Inputs.environmentVariables, {"required": false}),
            JvmOptions: core.getInput(Inputs.jvmOptions, {"required": false}),
            RuntimeVersion: core.getInput(Inputs.runtimeVersion, {"required": false}),
            DotNetCoreMainEntryPath: core.getInput(Inputs.dotNetCoreMainEntryPath, {"required": false}),
            Version: core.getInput(Inputs.version, {"required": false})
        }

        //Do not attempt to parse package in non-deployment steps. This causes variable substitution errors.
        if (taskParameters.Action == Actions.deploy) {
            taskParameters.Package = new Package(core.getInput(Inputs.package, {"required": true}));
        }

        core.debug('Task parameters: ' + JSON.stringify(taskParameters));
        return taskParameters;
    }
}


export interface TaskParameters {
    AzureSubscription: string,
    ResourceGroupName?: string;
    Action: string;
    ServiceName: string;
    AppName: string;
    UseStagingDeployment?: boolean;
    CreateNewDeployment?: boolean;
    DeploymentName?: string;
    EnvironmentVariables?: string;
    Package?: Package;
    JvmOptions?: string;
    RuntimeVersion?: string;
    DotNetCoreMainEntryPath?: string;
    Version?: string;
}