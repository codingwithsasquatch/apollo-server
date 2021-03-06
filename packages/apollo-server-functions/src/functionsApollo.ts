import {HttpContext, IFunctionRequest, HttpStatusCodes} from 'azure-functions-typescript'
import { GraphQLOptions, HttpQueryError, runHttpQuery } from 'apollo-server-core';
import * as GraphiQL from 'apollo-server-module-graphiql';

export interface FunctionsGraphQLOptionsFunction {
  (ctx: HttpContext): GraphQLOptions | Promise<GraphQLOptions>;
}

export interface FunctionsHandler {
  (req: any, next): void;
}

export function graphqlFunctions(options: GraphQLOptions | FunctionsGraphQLOptionsFunction): FunctionsHandler {
  if (!options) {
    throw new Error('Apollo Server requires options.');
  }

  if (arguments.length > 1) {
    throw new Error(`Apollo Server expects exactly one argument, got ${arguments.length}`);
  }

  return (ctx: HttpContext): Promise<void> => {
    return runHttpQuery([ctx], {
      method: ctx.req.method,
      options: options,
      query: ctx.req.method === 'POST' ? ctx.req.body : ctx.req.query,
    }).then((gqlResponse) => {
      ctx.res.headers['Content-Type'] = 'application/json';
      ctx.res.body = gqlResponse;
      ctx.done();
    }, (error: HttpQueryError) => {
      if ( 'HttpQueryError' !== error.name ) {
        throw error;
      }

      if ( error.headers ) {
        Object.keys(error.headers).forEach((header) => {
          ctx.set(header, error.headers[header]);
        });
      }

      ctx.res.status = error.statusCode;
      ctx.res.body = error.message;
    });
  };
}

export interface FunctionsGraphiQLOptionsFunction {
  (ctx: HttpContext): GraphiQL.GraphiQLData | Promise<GraphiQL.GraphiQLData>;
}

export function graphiqlFunctions(options: GraphiQL.GraphiQLData | FunctionsGraphiQLOptionsFunction) {
  return (ctx: HttpContext) => {
    const query = ctx.req.query;
    return GraphiQL.resolveGraphiQLString(query, options, ctx)
    .then((graphiqlString) => {
      ctx.res.headers['Content-Type'] = 'text/html';
      ctx.res.body = graphiqlString;
    }, error => {
      ctx.status = 500;
      ctx.res.body = error.message;
    });
  };
}

/* creates subpath endpoints for both GraphQL and Graphiql, so this function has two sub-routes:
    myfunc/graphql and myfunc/graphiql
*/
export function graphqlAndGraphiqlFunctions(
      graphqlOptions: GraphQLOptions | FunctionsGraphQLOptionsFunction,
      graphiqlOptions: GraphiQL.GraphiQLData | FunctionsGraphiQLOptionsFunction
    ) {
  const graphqlHandler = graphqlFunctions(graphqlOptions);
  const graphiqlHandler = graphiqlFunctions(graphiqlOptions);

  return (ctx: HttpContext)  => {
    console.log('path', ctx.req.params.path);
    switch(ctx.req.params.path)
    {
      case 'graphiql':
        console.log('route is GraphIql')
        return graphiqlHandler(ctx);
      default:
        console.log('route is Graphql')
        return graphqlHandler(ctx, null);
    }

  }
}
