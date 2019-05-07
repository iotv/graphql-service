import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import {Policy, Role} from '@pulumi/aws/iam'
import {Function, Runtime} from '@pulumi/aws/lambda'

type ServiceLambdaFunctionArgs = {
  s3Bucket: pulumi.Input<string>
  s3Key: pulumi.Input<string>
  handler: pulumi.Input<string>
  runtime: pulumi.Input<Runtime>
  iamPolicies: pulumi.Output<Policy>[]
}

export class ServiceLambdaFunction extends pulumi.ComponentResource {
  public readonly iamRole: Role
  public readonly lambdaFunction: pulumi.Output<Function>
  public readonly cloudwatchLogsIamPolicy: pulumi.Output<Policy>
  public readonly cloudwatchLogGroup: pulumi.Output<aws.cloudwatch.LogGroup>
  public readonly cloudwatchLogsIamPolicyAttachment: pulumi.Output<
    aws.iam.PolicyAttachment
  >
  public readonly iamPolicyAttachments: pulumi.Output<
    aws.iam.PolicyAttachment
  >[]

  constructor(
    name: string,
    args: ServiceLambdaFunctionArgs,
    opts?: pulumi.ResourceOptions,
  ) {
    super('iotv:ServiceLambdaFunction', name, args, opts)

    this.iamRole = new aws.iam.Role(
      `${name}`,
      {
        assumeRolePolicy: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
            },
          ],
        },
      },
      {parent: this},
    )

    this.lambdaFunction = this.iamRole.arn.apply(
      role =>
        new aws.lambda.Function(
          `${name}`,
          {
            runtime: args.runtime,
            role,
            handler: args.handler,
            s3Bucket: args.s3Bucket,
            s3Key: args.s3Key,
            timeout: 5,
            memorySize: 1024,
          },
          {parent: this},
        ),
    )

    this.cloudwatchLogGroup = this.lambdaFunction.apply(lambdaFunction =>
      lambdaFunction.name.apply(
        lambdaName =>
          new aws.cloudwatch.LogGroup(
            lambdaName,
            {
              name: `/aws/lambda/${lambdaName}`,
              retentionInDays: 7,
            },
            {parent: this},
          ),
      ),
    )

    this.cloudwatchLogsIamPolicy = this.cloudwatchLogGroup.apply(
      cloudwatchLogGroup =>
        cloudwatchLogGroup.arn.apply(cloudwatchLogGroupArn => {
          const arn = cloudwatchLogGroupArn.substring(
            0,
            cloudwatchLogGroupArn.length - 2,
          )
          const policy: aws.iam.PolicyDocument = {
            Version: '2012-10-17',
            Statement: [
              {
                Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
                Effect: 'Allow',
                Resource: '*',
              },
            ],
          }
          return new aws.iam.Policy(
            `${name}`,
            {
              namePrefix: name,
              policy: JSON.stringify(policy),
            },
            {parent: this},
          )
        }),
    )

    this.cloudwatchLogsIamPolicyAttachment = this.cloudwatchLogsIamPolicy
      .apply(cloudwatchLogsIamPolicy => cloudwatchLogsIamPolicy.arn)
      .apply(
        policyArn =>
          new aws.iam.PolicyAttachment(
            `${name}`,
            {policyArn, roles: [this.iamRole]},
            {parent: this},
          ),
      )

    this.iamPolicyAttachments = args.iamPolicies.map(output =>
      output.apply(
        policy =>
          new aws.iam.PolicyAttachment(
            `${name}-${policy.name}`,
            {policyArn: policy.arn, roles: [this.iamRole]},
            {parent: this},
          ),
      ),
    )

    this.registerOutputs({
      iamRole: this.iamRole,
      lambdaFunction: this.lambdaFunction,
      cloudwatchLogsIamPolicy: this.cloudwatchLogsIamPolicy,
      cloudwatchLogGroup: this.cloudwatchLogGroup,
      cloudwatchLogsIamPolicyAtachment: this.cloudwatchLogsIamPolicyAttachment,
      iamPolicyAttachments: this.iamPolicyAttachments,
    })
  }
}
