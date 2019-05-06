import {handleGraphQL} from './handler'

describe('handler', () => {
  it('should test nothing', async () => {
    const result = await handleGraphQL(
      {
        headers: {},
        body: `${JSON.stringify({
          query:
            'mutation applyForBeta($email: String!) {applyForBeta(email: $email)}',
          variables: {email: 'd@d.com'},
        })}`,
      },
      {},
    )
    expect(result).toEqual({})
  })
})
