import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import {ServiceLambdaFunction} from './src/service'
import {HttpService} from './src/http-service/service'
import {Output} from '@pulumi/pulumi'
import {Policy} from '@pulumi/aws/iam'

const config = new pulumi.Config('pulumi-1-graphql-service')
const codeDeployStack = new pulumi.StackReference(
  config.require('codeDeployStack'),
)
const userDBStack = new pulumi.StackReference(config.require('userDBStack'))
const userDBPolicies: Output<Policy>[] = [
  userDBStack
    .getOutput('authentications')
    .apply(db => db.readWriteAccessPolicy),
  userDBStack
    .getOutput('betaApplications')
    .apply(db => db.readWriteAccessPolicy),
  userDBStack.getOutput('betaInvites').apply(db => db.readWriteAccessPolicy),
  userDBStack
    .getOutput('emailAuthentications')
    .apply(db => db.readWriteAccessPolicy),
  userDBStack.getOutput('users').apply(db => db.readWriteAccessPolicy),
]

const graphqlLambda = new ServiceLambdaFunction('graphql', {
  handler: 'dist/src/handler.handleGraphQL',
  runtime: aws.lambda.NodeJS8d10Runtime,
  s3Bucket: codeDeployStack.getOutput('bucketName'),
  s3Key: config.require('graphql'),
  iamPolicies: userDBPolicies,
})

const graphqlPreflightLambda = new ServiceLambdaFunction('preflightGraphQL', {
  handler: 'dist/src/handler.handleCorsPreflight',
  runtime: aws.lambda.NodeJS8d10Runtime,
  s3Bucket: codeDeployStack.getOutput('bucketName'),
  s3Key: config.require('graphql'),
  iamPolicies: userDBPolicies,
})

const createPasswordHashLambda = new ServiceLambdaFunction(
  'createPasswordHash',
  {
    handler: 'dist/create-password-hash',
    runtime: aws.lambda.Go1dxRuntime,
    s3Bucket: codeDeployStack.getOutput('bucketName'),
    s3Key: config.require('createPasswordHash'),
    iamPolicies: userDBPolicies,
  },
)

const verifyPasswordHashLambda = new ServiceLambdaFunction(
  'verifyPasswordHash',
  {
    handler: 'dist/verify-password-hash',
    runtime: aws.lambda.Go1dxRuntime,
    s3Bucket: codeDeployStack.getOutput('bucketName'),
    s3Key: config.require('verifyPasswordHash'),
    iamPolicies: userDBPolicies,
  },
)

const passwordServicePolicy = pulumi
  .all([
    createPasswordHashLambda.lambdaFunction.apply(it => it.arn),
    verifyPasswordHashLambda.lambdaFunction.apply(it => it.arn),
  ])
  .apply(([createPasswordHashArn, verifyPasswordHashArn]) => {
    const passwordServicePolicyDocument: aws.iam.PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Action: ['lambda:InvokeFunction'],
          Effect: 'Allow',
          Resource: [createPasswordHashArn, verifyPasswordHashArn],
        },
      ],
    }
    return new aws.iam.Policy('passwordService', {
      policy: JSON.stringify(passwordServicePolicyDocument),
    })
  })

const passwordServicePolicyAttachment = passwordServicePolicy.apply(policy => {
  new aws.iam.PolicyAttachment('graphqlCanCallPassword', {
    policyArn: policy.arn,
    roles: [graphqlLambda.iamRole],
  })
})

const httpService = pulumi
  .all([pulumi.output(graphqlLambda), pulumi.output(graphqlPreflightLambda)])
  .apply(
    ([graphqlLambda, graphqlPreflightLambda]) =>
      new HttpService('graphql-service', {
        description: '',
        resources: {
          graphql: {
            methods: {
              POST: {
                lambda: graphqlLambda,
              },
              OPTIONS: {
                lambda: graphqlPreflightLambda,
              },
            },
          },
        },
      }),
  )

export const restApiId = httpService.apply(
  httpService => httpService.apiGatewayRestApi.id,
)
