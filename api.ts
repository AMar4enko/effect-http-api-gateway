import * as HttpApi from '@effect/platform/HttpApi'
import * as HttpApiGroup from '@effect/platform/HttpApiGroup'
import * as HttpApiSecurity from '@effect/platform/HttpApiSecurity'
import * as OpenApi from '@effect/platform/OpenApi'

import { FetchRandomUser } from './endpoints'

const organization = HttpApiGroup.make(`Organization`).pipe(
  HttpApiGroup.annotate(OpenApi.Security, HttpApiSecurity.basic),
  HttpApiGroup.add(FetchRandomUser),
)

const Api = HttpApi.empty.pipe(
  HttpApi.addGroup(`/organization`, organization),
)

export default Api