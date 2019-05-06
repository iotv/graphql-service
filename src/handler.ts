import * as AWS from 'aws-sdk'
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLFieldConfigMap,
  GraphQLString,
  GraphQLNonNull,
  GraphQLBoolean,
} from 'graphql'
import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from 'aws-lambda'

import {User} from './graphql-types'
import {
  applyForBeta,
  loginWithEmailAndPassword,
  signUpWithEmailAndPassword,
} from './resolvers'

AWS.config.update({
  region: 'us-east-1',
})

const queryFields: GraphQLFieldConfigMap<any, any> = {
  User: {
    type: User,
    resolve: () => ({
      id: 'hola',
    }),
  },
}

const mutationFields: GraphQLFieldConfigMap<any, any> = {
  applyForBeta: {
    args: {
      email: {
        description: 'email with which to apply for beta.',
        type: GraphQLNonNull(GraphQLString),
      },
    },
    resolve: applyForBeta,
    type: GraphQLBoolean,
  },

  loginWithEmailAndPassword: {
    args: {
      email: {
        description: 'email for authentication',
        type: GraphQLNonNull(GraphQLString),
      },
      password: {
        description: 'password for authentication',
        type: GraphQLNonNull(GraphQLString),
      },
    },
    resolve: loginWithEmailAndPassword,
    type: User,
  },

  signUpWithEmailAndPassword: {
    args: {
      email: {
        description: 'email with which to register',
        type: GraphQLNonNull(GraphQLString),
      },
      inviteToken: {
        description: 'token granted to allow beta registration',
        type: GraphQLNonNull(GraphQLString),
      },
      password: {
        description: 'password used in the future for authentication',
        type: GraphQLNonNull(GraphQLString),
      },
      userName: {
        description: 'username used for public presentation of a user',
        type: GraphQLNonNull(GraphQLString),
      },
    },
    resolve: signUpWithEmailAndPassword,
    type: User,
  },
}

export async function handleCorsPreflight(
  event: Partial<APIGatewayProxyEvent>,
  context: Partial<Context>,
): Promise<APIGatewayProxyResult> {
  return {
    statusCode: 200,
    body: '',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'OPTIONS, POST',
      'Access-Control-Allow-Headers': [
        ...Object.keys(event.headers),
        'content-type',
        'x-apollo-tracing',
      ].join(','),
    },
  }
}

export async function handleGraphQL(
  event: Partial<APIGatewayProxyEvent>,
  context: Partial<Context>,
): Promise<APIGatewayProxyResult> {
  let cookie: string
  const result = await graphql({
    contextValue: {
      ...context,
      cookieJar: {
        setCookie: (val: string) => {
          cookie = val
        },
      },
    },
    schema: new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: queryFields,
      }),
      mutation: new GraphQLObjectType({
        name: 'Mutation',
        fields: mutationFields,
      }),
    }),
    source: JSON.parse(event.body).query,
    variableValues: JSON.parse(event.body).variables,
  })
  return {
    statusCode: 200,
    body: JSON.stringify(result),
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'OPTIONS, POST',
      'Access-Control-Allow-Headers': [
        ...Object.keys(event.headers),
        'content-type',
        'x-apollo-tracing',
      ].join(','),
      'Set-Cookie': `auth=${cookie}; Secure`,
    },
  }
}
