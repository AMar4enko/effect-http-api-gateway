import * as NodeContext from '@effect/platform-node/NodeContext'
import * as HttpApi from '@effect/platform/HttpApi'
import * as Etag from '@effect/platform/Etag'
import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'

import { Effect, Layer, ManagedRuntime } from 'effect'
import * as HttpPlatform from '@effect/platform/HttpPlatform'
import { createServerAdapter } from '@whatwg-node/server'
import { Identity } from '../services/Identity'
import * as HttpServerRequest from '@effect/platform/HttpServerRequest'
import * as HttpServerResponse from '@effect/platform/HttpServerResponse'
import { APIGatewayEventRequestContext } from 'aws-lambda'
import { cors } from '@effect/platform/HttpMiddleware'
import Api from './api'

const Organization = HttpApiBuilder.group(Api, `Organization`, (handlers) => handlers.pipe(
  HttpApiBuilder.handle(`FetchRandomUser`, (req) => Effect.gen(function* (){
    return {
      name: `John Doe`,
      randomAge: Math.floor(Math.random() * 100)
    }
  }))
))

const ApiLive = HttpApiBuilder.api(HttpApi.empty)
  .pipe(
    Layer.provide(Organization),
  )


const managedRuntime = ManagedRuntime.make(
  Layer.mergeAll(
    ApiLive,
    
  ).pipe(
    Layer.provideMerge(NodeContext.layer)
  )
)

const app = HttpApiBuilder.httpApp.pipe(Effect.flatten, cors({ allowedOrigins: [`*`], allowedHeaders: [`*`] }))

export const adapter = createServerAdapter((req: Request, ...rest): Promise<Response> => {
  const ctx: APIGatewayEventRequestContext = (rest[0] as any).event.requestContext

  /** 
   * My API Gateway uses Cognito authorizer, 
   * that supplies caller identity via second endpoint handler parameter
   * In my endpoint implementations I fetch identity from the context via 
   * ```
   * identityFromContext = FiberRef.get(FiberRef.currentContext).pipe(
   *   Effect.map((ctx) => Context.unsafeGet(ctx, Identity))
   * )
   * 
   * const identity = yield* identityFromContext
   */

  return app.pipe(
    Effect.provide(Identity.fromApiGatewayEventAuthorizerContext(ctx)),
    Effect.provideService(HttpServerRequest.HttpServerRequest, HttpServerRequest.fromWeb(req)),
    Effect.map(HttpServerResponse.toWeb),
    managedRuntime.runPromise
  )
})