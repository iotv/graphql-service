import * as AWS from 'aws-sdk'
import cuid from 'cuid'
import {Context} from 'aws-lambda'
import {CookieMixin} from './graphql-types'
import {GraphQLFieldResolver} from 'graphql'
import * as Yup from 'yup'
import {get} from 'lodash'
import {Lambda} from 'aws-sdk'

export const applyForBeta: GraphQLFieldResolver<any, any> = async (
  root,
  {email},
) => {
  const db = new AWS.DynamoDB()
  await Yup.string()
    .email()
    .validate(email)
  await db
    .transactWriteItems({
      TransactItems: [
        {
          Put: {
            ConditionExpression: 'attribute_not_exists(Email)',
            Item: {
              Email: {S: email},
            },
            TableName: 'BetaApplications-dev-ee01dc8',
          },
        },
      ],
    })
    .promise()
  // FIXME: handle cases when it doesn't work
  return true
}

export const loginWithEmailAndPassword: GraphQLFieldResolver<
  any,
  Context & CookieMixin
> = async (root, {email, password}, context) => {
  const db = new AWS.DynamoDB()
  const lambda = new AWS.Lambda()

  await Yup.object({
    email: Yup.string()
      .email()
      .required(),
    password: Yup.string()
      .min(8)
      .required(),
  }).validate({email, password})

  let emailAuthentication
  try {
    emailAuthentication = await db
      .getItem({
        Key: {S: email},
        TableName: 'EmailAuthentications-devEmailUniqueIndex-1c47cd5',
      })
      .promise()
  } catch {
    emailAuthentication = null
  }

  let authValidation: Lambda.InvocationResponse
  try {
    // FIXME: this should send a more valid hash
    authValidation = await lambda
      .invoke({
        // FIXME: Correct function name here
        FunctionName: 'verifyPasswordHash-735c358',
        Payload: JSON.stringify({
          password,
          passwordHash: get(
            emailAuthentication,
            'Item.HashedPassword.S',
            'THISALWAYSFAILS',
          ),
        }),
      })
      .promise()
  } catch (e) {
    // FIXME: make this error better
    throw e
  }
  let {isValid} = JSON.parse(authValidation.Payload.toString())
  if (isValid === true) {
    context.cookieJar.setCookie('test')
  }
}

export const signUpWithEmailAndPassword: GraphQLFieldResolver<
  any,
  any
> = async (root, {email, inviteToken, password, userName}) => {
  const db = new AWS.DynamoDB()

  await Yup.object({
    email: Yup.string()
      .email()
      .required(),
    password: Yup.string()
      .min(8)
      .required(),
    userName: Yup.string()
      .min(5)
      .max(24)
      .required(),
  }).validate({
    email,
    password,
    userName,
  })

  const lambda = new AWS.Lambda()
  const authenticationId = cuid()
  const emailAuthenticationId = cuid()
  const createPasswordResponse = await lambda
    .invoke({
      FunctionName: 'createPasswordHash-ca0dc85',
      Payload: JSON.stringify({password}),
    })
    .promise()
  const {passwordHash} = JSON.parse(createPasswordResponse.Payload as string)
  const userId = cuid()

  await db
    .transactWriteItems({
      TransactItems: [
        {
          Put: {
            ConditionExpression: 'attribute_not_exists(AuthenticationId)',
            Item: {
              AuthenticationId: {S: authenticationId},
              EmailAuthenticationId: {S: emailAuthenticationId},
              UserId: {S: userId},
            },
            TableName: 'Authentications-dev-e97c67f',
          },
        },
        {
          Put: {
            ConditionExpression: 'attribute_not_exists(EmailAuthenticationId)',
            Item: {
              EmailAuthenticationId: {S: emailAuthenticationId},
              AuthenticationId: {S: authenticationId},
            },
            TableName:
              'Authentications-devEmailAuthenticationIdUniqueIndex-6807c98',
          },
        },
        {
          Put: {
            ConditionExpression: 'attribute_not_exists(EmailAuthenticationId)',
            Item: {
              Email: {S: email},
              EmailAuthenticationId: {S: emailAuthenticationId},
              HashedPassword: {S: passwordHash},
              UserId: {S: userId},
            },
            TableName: 'EmailAuthentications-dev-31915e6',
          },
        },
        {
          Put: {
            ConditionExpression: 'attribute_not_exists(Email)',
            Item: {
              Email: {S: email},
              EmailAuthenticationId: {S: emailAuthenticationId},
            },
            TableName: 'EmailAuthentications-devEmailUniqueIndex-1c47cd5',
          },
        },
        {
          Put: {
            ConditionExpression: 'attribute_not_exists(UserId)',
            Item: {
              EmailAuthenticationId: {S: emailAuthenticationId},
              UserId: {S: userId},
            },
            TableName: 'EmailAuthentications-devUserIdUniqueIndex-4b68b3c',
          },
        },
        {
          Put: {
            ConditionExpression: 'attribute_not_exists(UserId)',
            Item: {
              Email: {S: email},
              UserId: {S: userId},
              UserName: {S: userName},
            },
            TableName: 'Users-dev-2f5fdd5',
          },
        },
        {
          Put: {
            ConditionExpression: 'attribute_not_exists(Email)',
            Item: {
              Email: {S: email},
              UserId: {S: userId},
            },
            TableName: 'Users-devEmailUniqueIndex-c21f045',
          },
        },
        {
          Put: {
            ConditionExpression: 'attribute_not_exists(UserName)',
            Item: {
              UserId: {S: userId},
              UserName: {S: userName},
            },
            TableName: 'Users-devUserNameUniqueIndex-162761c',
          },
        },
        {
          Delete: {
            ConditionExpression: 'InviteToken = :InviteToken',
            ExpressionAttributeValues: {
              ':InviteToken': {
                S: inviteToken,
              },
            },
            Key: {
              Email: {S: email},
            },
            TableName: 'BetaInvites-dev-02f6f10',
          },
        },
      ],
    })
    .promise()

  return {
    id: userId,
    userName,
  }
}
