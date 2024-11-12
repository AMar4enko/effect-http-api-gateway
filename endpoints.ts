import { Schema as S } from '@effect/schema'
import * as Endpoint from '@effect/platform/HttpApiEndpoint'
import { TaggedError } from '@effect/schema/Schema'
import { AnnotationStatus } from '@effect/platform/HttpApiSchema'

export class UnknownException extends TaggedError<UnknownException>()(
  `UnknownException`,
  {
    cause: S.optional(S.Unknown),
    message: S.optional(S.String)
  }
) {}

export class ForbiddenException extends TaggedError<ForbiddenException>()(
  `ForbiddenException`,
  {
    cause: S.optional(S.Unknown),
    message: S.optional(S.String)
  },
  {
    [AnnotationStatus]: 403
  }
) {}

export const FetchRandomUser = Endpoint.get(`FetchRandomUser`, `/users/random/:seed`).pipe(
  Endpoint.setSuccess(
    S.Struct({
      name: S.String,
      randomAge: S.Number,
    })
  ),
  Endpoint.setPath(S.Struct({
    seed: S.NumberFromString
  })),
  Endpoint.addError(UnknownException)
)