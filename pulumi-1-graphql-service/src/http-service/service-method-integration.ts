import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import {ServiceLambdaFunction} from '../service'

type HttpServiceMethodIntegrationArgs = {
  httpMethod: pulumi.Input<string>
  lambda: pulumi.Input<ServiceLambdaFunction>
  restApi: pulumi.Input<aws.apigateway.RestApi>
  resource: pulumi.Input<aws.apigateway.Resource>
}

export class HttpServiceMethodIntegration extends pulumi.ComponentResource {
  public readonly apiGatewayMethod: pulumi.Output<aws.apigateway.Method>
  public readonly apiGatewayIntegration: pulumi.Output<
    aws.apigateway.Integration
  >
  public readonly lambdaPermission: pulumi.Output<aws.lambda.Permission>

  constructor(
    name: string,
    args: HttpServiceMethodIntegrationArgs,
    opts?: pulumi.ResourceOptions,
  ) {
    super('iotv:HttpServiceMethodIntegration', name, args, opts)

    this.apiGatewayMethod = pulumi
      .all([
        args.httpMethod,
        args.restApi,
        pulumi.output(args.resource).apply(resource => resource.id),
      ])
      .apply(
        ([httpMethod, restApi, resourceId]) =>
          new aws.apigateway.Method(
            name,
            {
              httpMethod,
              restApi,
              authorization: 'NONE',
              resourceId,
            },
            {parent: this},
          ),
      )

    this.apiGatewayIntegration = pulumi
      .all([
        aws.getRegion(),
        args.httpMethod,
        args.restApi,
        pulumi.output(args.resource).apply(resource => resource.id),
        pulumi
          .output(args.lambda)
          .apply(lambda => lambda.lambdaFunction.apply(fn => fn.arn)),
      ])
      .apply(
        ([{name: region}, httpMethod, restApi, resourceId, lambdaArn]) =>
          new aws.apigateway.Integration(
            name,
            {
              type: 'AWS_PROXY',
              httpMethod,
              integrationHttpMethod: 'POST',
              restApi,
              resourceId,
              uri: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${lambdaArn}/invocations`,
            },
            {parent: this},
          ),
      )

    this.lambdaPermission = pulumi
      .all([
        aws.getRegion(),
        aws.getCallerIdentity(),
        pulumi.output(args.restApi).apply(restApi => restApi.id),
        args.httpMethod,
        pulumi.output(args.resource).apply(resource => resource.path),
        pulumi
          .output(args.lambda)
          .apply(lambda => lambda.lambdaFunction.apply(fn => fn.arn)),
      ])
      .apply(
        ([
          {name: region},
          {accountId},
          restApiId,
          httpMethod,
          resourcePath,
          lambdaArn,
        ]) =>
          new aws.lambda.Permission(
            name,
            {
              action: 'lambda:InvokeFunction',
              principal: 'apigateway.amazonaws.com',
              function: lambdaArn,
              sourceArn: `arn:aws:execute-api:${region}:${accountId}:${restApiId}/*/${httpMethod}${resourcePath}`,
            },
            {parent: this},
          ),
      )

    this.registerOutputs({
      apiGatewayMethod: this.apiGatewayMethod,
      apiGatewayIntegration: this.apiGatewayIntegration,
      lambdaPermission: this.lambdaPermission,
    })
  }
}
