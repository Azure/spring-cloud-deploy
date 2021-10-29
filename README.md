# GitHub Action for deploying to Azure Spring Cloud
GitHub Actions support an automated software development lifecycle workflow. With GitHub Actions for Azure Spring Cloud you can create workflows in your repository to manage your deployment of Azure Spring Cloud conveniently.

[comment]: <> (This repository contains GitHub Action for Azure Spring Cloud to deploy. The action supports deploying *.jar, *.war, and *.zip files, or a folder.)

[comment]: <> (As the maintainer of this project, please make a few updates:)

[comment]: <> (- Improving this README.MD file to provide a great experience)

[comment]: <> (- Updating SUPPORT.MD with content about this project's support experience)

[comment]: <> (- Understanding the security reporting process in SECURITY.MD)

[comment]: <> (- Remove this section from the README)
## Prerequisites
### Set up GitHub repository and authenticate
You need an Azure service principal credential to authorize Azure login action. To get an Azure credential, execute the following commands on your local machine:
```azurecli
az login
az ad sp create-for-rbac --role contributor --scopes /subscriptions/<SUBSCRIPTION_ID> --sdk-auth
```

To access to a specific resource group, you can reduce the scope:

```azurecli
az ad sp create-for-rbac --role contributor --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP> --sdk-auth
```
The command should output a JSON object:

```json
{
    "clientId": "<GUID>",
    "clientSecret": "<GUID>",
    "subscriptionId": "<GUID>",
    "tenantId": "<GUID>",
    ...
}
```

### Dependencies on other GitHub Actions
* [Checkout](https://github.com/actions/checkout) Checkout your Git repository content into GitHub Actions agent.
* Authenticate using the [Azure Login Action](https://github.com/Azure/login) with the Azure service principal credential prepared as mentioned above. Examples are given later in this article.

## End-to-End Sample Workflows
### Deleting a staging deployment

The "Delete Staging Deployment" action allows you to delete the deployment not receiving production traffic. This frees up resources used by that deployment and makes room for a new staging deployment:

```yml
name: AzureSpringCloud
on: push
env:
  ASC_PACKAGE_PATH: ${{ github.workspace }}
  AZURE_SUBSCRIPTION: <azure subscription name>

jobs:
  hello_world_job:
    runs-on: ubuntu-latest
    name: Delete staging deployment
    steps:
      - name: Checkout Github Action
        uses: actions/checkout@master

      - name: Login via Azure CLI
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Delete staging deployment step
        uses: azure/spring-cloud-git-action@v1
        with:
          azure-subscription: ${{ env.AZURE_SUBSCRIPTION }}
          action: Delete Staging Deployment
          service-name: <service instance name>
          app-name: <app name>
```

### Deploying

#### To production

The following example deploys to the default production deployment in Azure Spring Cloud. This is the only possible deployment scenario when using the Basic SKU:

```yml
variables:
  azureSubscription: Contoso

steps:
- task: AzureSpringCloud@0
    inputs:
    azureSubscription: $(azureSubscription)
    Action: 'Deploy'
    AzureSpringCloud: contoso-dev-az-spr-cld
    AppName: customer-api
    UseStagingDeployment: false
    DeploymentName: default
    Package: '$(System.DefaultWorkingDirectory)/**/*customer-api*.jar'
```

#### Blue-green

The following example deploys to a pre-existing staging deployment. This deployment will not receive production traffic until it is set as a production deployment.

```yml
variables:
  azureSubscription: Contoso

steps:
- task: AzureSpringCloud@0
    inputs:
    azureSubscription: $(azureSubscription)
    Action: 'Deploy'
    AzureSpringCloud: contoso-dev-az-spr-cld
    AppName: customer-api
    UseStagingDeployment: true
    Package: '$(System.DefaultWorkingDirectory)/**/*customer-api*.jar'
```

For more on blue-green deployments, including an alternative approach, see [Blue-green deployment strategies](/azure/spring-cloud/concepts-blue-green-deployment-strategies).

### Setting production deployment

The following example will set the current staging deployment as production, effectively swapping which deployment will receive production traffic.

```yml
variables:
  azureSubscription: Contoso

steps:
- task: AzureSpringCloud@0
    inputs:
    azureSubscription: $(azureSubscription)
    Action: 'Set Production'
    AzureSpringCloud: contoso-dev-az-spr-cld
    AppName: customer-api
    UseStagingDeployment: true
```
## Contributing
This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft 
trademarks or logos is subject to and must follow 
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.
