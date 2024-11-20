import { Schema as S, Layer, Effect } from 'effect'

const CommaSeparatedValues = S.String.pipe(
  S.transform(
    S.Array(S.String),
    {
      decode(fromA) {
        return fromA.split(`,`)
      },
      encode(toI) {
        return toI.join(`,`)
      },
    },
  ),
)

const ApiGatewayEventAuthorizerContextSchema = S.Struct({
  'email': S.String,
  'sub': S.String,
  'cognito:username': S.String,
  'cognito:groups': S.Union(CommaSeparatedValues, S.Array(S.String)),
})

const decodeIdentityFromEvent = S.decodeSync(ApiGatewayEventAuthorizerContextSchema)

type AuthorizerContextSchema = typeof ApiGatewayEventAuthorizerContextSchema.Type

export const make = (authCtx: AuthorizerContextSchema) => Effect.gen(function* () {
  return {
    username: authCtx['cognito:username']
  }
})

export interface IdentityService extends Effect.Success<ReturnType<typeof make>> {}

export class Identity extends Effect.Tag('CognitoIdentity')<Identity, IdentityService>() {

  /**
   * Static method to create Layer with Identity service instance from API Gateway authorizer context
   */
  static fromApiGatewayEventAuthorizerContext = (ctx: APIGatewayEventRequestContext) => {
    const claims = decodeIdentityFromEvent(ctx.authorizer!.claims)
    const svc = make(claims)
    return Layer.effect(Identity, svc)
  }


  /**
   * Method to access identity from effect context without listing Identity service in Effect context requirements
   */
  static getFromContext = FiberRef.get(FiberRef.currentContext).pipe(
    Effect.map((ctx) => Context.unsafeGet(ctx, Identity))
  )
}