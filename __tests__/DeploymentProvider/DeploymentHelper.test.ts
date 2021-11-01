import { AppPlatformManagementClient, AppPlatformManagementModels as Models } from '@azure/arm-appplatform'
import * as identity from '@azure/identity'
import {ActionParameters, ActionParametersUtility} from "../../src/operations/actionParameters";
import {DeploymentHelper} from "../../src/DeploymentProvider/DeploymentHelper";

jest.mock('@azure/identity');
jest.mock('@actions/core');

describe('Test azure-spring-cloud-deployment-helper', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    })
    let clientMock: jest.Mocked<AppPlatformManagementClient> = new AppPlatformManagementClient(new identity.DefaultAzureCredential(), '') as any;
    let paramsMock: jest.Mocked<ActionParameters> = {} as any;
    let deploymentListMock: Array<Models.DeploymentResource> = [
        {
            properties: {
                active: false
            },
            name: 'staging'
        },
        {
            properties: {
                active: true
            },
            name: 'production'
        }
    ]
    clientMock.deployments.list = jest.fn().mockReturnValue(deploymentListMock as Models.DeploymentResourceCollection);
    test("get staging deployment name", async () => {
        const stagingName = await DeploymentHelper.getStagingDeploymentName(clientMock, paramsMock);
        expect(stagingName).toBe('staging');
    });

    test("gets all deployment names", async () => {
        const names = await DeploymentHelper.getAllDeploymentsName(clientMock, paramsMock);
        expect(names).toMatchObject(['staging', 'production']);
    });

});
