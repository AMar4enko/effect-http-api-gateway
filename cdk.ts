import { Function, StackContext, use } from 'sst/constructs'
import { fromApi, annotate, OpenAPISpecMethodName } from '@effect/platform/OpenApi'
import { AssetApiDefinition, SpecRestApi } from 'aws-cdk-lib/aws-apigateway'
import API from './api.js'
import { Record } from 'effect'
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam'

const API_METHODS: Array<OpenAPISpecMethodName> = [`get`, `post`, `put`, `delete`, `options`, `head`, `patch`]

/**
 * This is SST v2, which is CDK wrapper
 * stack and app are CDK Stack and App
 * 
 * So they key principle here is to patch OpenAPI spec derived from HttpApi
 * and augment it with ApiGateway specific annotations to attach integrations
 * to endpoint. Each endpoint will have it's dedicated function, yet all functions
 * will share single handler file.
 */
export const ApiGatewayStack = ({ stack, app }: StackContext) => {
  const apiName = `ApiGateway from HttpApi`

  const spec = fromApi(API.pipe(
    annotate({
      title: apiName
    })
  ))

  const corsHeaders = {
    "Access-Control-Allow-Origin": {
      "schema": {
        "type": "string"
      }
    }
  }

  const cors = {
    "allowOrigins": app.stage === `prod` ?
    [
      "..."
    ] : [
      "*"
    ],
    "allowMethods": [
      "GET",
      "OPTIONS",
      "POST",
      "PUT",
      "DELETE",
      "HEAD",
    ],
    "allowHeaders": [
      "x-amzm-header",
      "x-apigateway-header",
      "x-api-key",
      "authorization",
      "x-amz-date",
      "content-type"
    ]
  }

  const corsOptionsMethod = {
    'x-amazon-apigateway-integration': {
      type: `mock`,
      requestTemplates: {
        'application/json': `{"statusCode" : 200}`
      },
      responses: {
        default: {
          statusCode: 200,
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': "'*'",
            'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,POST,PUT,DELETE,HEAD,PATCH'",
            'method.response.header.Access-Control-Allow-Origin': "'*'"
          }
        }
      }
    },
    "responses": {
      "200": {
        "description": "200 response",
        "headers": {
          'Access-Control-Allow-Headers': {
            schema: {
              type: `string`
            }
          },
          'Access-Control-Allow-Methods': {
            schema: {
              type: `string`
            }
          },
          'Access-Control-Allow-Origin': {
            schema: {
              type: `string`
            },
          },
        }
      }
    },
  }

  const modifiedSpec = {
    ...spec,
    paths: Record.map(spec.paths, (path) => {
      const integrations = API_METHODS.map((method) => {
        if (!path[method]) return null;

        const operationId = path[method].operationId!.replace(/\./g, '-')

        const fn = new Function(stack, operationId, {
          handler: `src/v2/api-gateway/handler.handler`,
        })

        fn.addPermission(`allow-api-gateway`, {
          principal: new ServicePrincipal(`apigateway.amazonaws.com`)          
        })

        const successResponse = (path[method].responses ?? {})[`200`] ?? {}


        return [method, {
          ...path[method],
          [`x-amazon-apigateway-integration`]: { 
            uri: `arn:aws:apigateway:${app.region}:lambda:path/2015-03-31/functions/${fn.functionArn}/invocations`,
            passthroughBehavior: "when_no_match",
            httpMethod: "POST",
            type: "aws_proxy"
          },
          responses: {
            ...path[method].responses,
            [`200`]: {
              ...successResponse,
              headers: {
                ...successResponse.headers,
                ...corsHeaders
              }
            }
          }
        }]
      })


      return {
        ...path,
        ...Object.fromEntries(integrations.filter(Boolean) as any),
        options: corsOptionsMethod
      }
    }),
    [`x-amazon-apigateway-cors`]: cors,
    components: {
      ...spec.components,
      securitySchemes: {
        [`Basic`]: {
          "type": "apiKey",
          "name": "Authorization",
          "in": "header",
          "x-amazon-apigateway-authtype": "cognito_user_pools",
          "x-amazon-apigateway-authorizer": {
            "type": "cognito_user_pools",
            "providerARNs": [
              userPool.userPoolArn
            ]
          }
        }
      }
    }  
  }

  const apiDefinition = AssetApiDefinition.fromInline(modifiedSpec)
  
  const api = new SpecRestApi(stack, apiName, {
    apiDefinition,
    deploy: true,
  })

  stack.addOutputs({
    apiNextUrl: api.url
  })

  return {
    url: api.url
  }
}