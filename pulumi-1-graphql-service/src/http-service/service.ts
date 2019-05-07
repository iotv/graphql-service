import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'

import {HttpServiceResource} from './service-resource'
import {HttpServiceResourceMap} from './types'

export type HttpServiceArgs = {
  description: string
  resources: HttpServiceResourceMap
}

export class HttpService extends pulumi.ComponentResource {
  public readonly apiGatewayRestApi: aws.apigateway.RestApi
  public readonly httpServiceResources: pulumi.Output<HttpServiceResource>[]
  public readonly apiGatewayDeployment: pulumi.Output<aws.apigateway.Deployment>

  constructor(
    name: string,
    args: HttpServiceArgs,
    opts?: pulumi.ResourceOptions,
  ) {
    super('iotv:HttpService', name, args, opts)
    this.apiGatewayRestApi = new aws.apigateway.RestApi(
      `${name}`,
      {description: args.description},
      {parent: this},
    )

    this.httpServiceResources = Object.keys(args.resources).map(pathPart =>
      this.apiGatewayRestApi.rootResourceId.apply(
        parentId =>
          new HttpServiceResource(
            `${name}${pathPart}`,
            {
              parentId,
              restApi: this.apiGatewayRestApi,
              pathPart,
              config: args.resources[pathPart],
            },
            {parent: this},
          ),
      ),
    )

    this.apiGatewayDeployment = pulumi.all(this.httpServiceResources).apply(
      resources =>
        new aws.apigateway.Deployment(
          name,
          {
            restApi: this.apiGatewayRestApi,
            stageName: 'master',
          },
          {
            parent: this,
            dependsOn: resources
              .reduce(
                (acc, {methodIntegrations}) => [...acc, ...methodIntegrations],
                [],
              )
              .reduce(
                (acc, {apiGatewayIntegration, apiGatewayMethod}) => [
                  ...acc,
                  apiGatewayIntegration,
                  apiGatewayMethod,
                ],
                [],
              ),
          },
        ),
    )

    this.registerOutputs({
      apiGatewayRestApi: this.apiGatewayRestApi,
      httpServiceResources: this.httpServiceResources,
      apiGatewayDeployment: this.apiGatewayDeployment,
    })
  }
}
