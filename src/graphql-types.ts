import {GraphQLObjectType, GraphQLNonNull, GraphQLID} from 'graphql'

export const User = new GraphQLObjectType({
  name: 'User',
  fields: {
    id: {
      type: GraphQLNonNull(GraphQLID),
    },
  },
})

export interface CookieMixin {
  cookieJar: {
    setCookie: (val: string) => void
  }
}
