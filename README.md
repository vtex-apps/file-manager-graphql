# Product Review GraphQL Example

Example app, showcasing a GraphQL API for a product review page.

# Learn GraphQL

GraphQL is a new API format that is becoming more popular each day. If you want to learn more about it, there are many resources out there. Here are a few very good ones:

- http://graphql.org/learn/
- https://www.howtographql.com/

# GraphQL app

You can easily build your own GraphQL API using VTEX IO, by specifying the **graphql** builder on your `manifest.json`. You can do this manually, or you can use the [VTEX toolbelt](https://github.com/vtex/toolbelt) to help, by running `vtex init`. For example:

```sh
info:    Hello! I will help you generate basic files and folders for your app.
? What's your VTEX app name? product-review-graphql-example
? What's your VTEX app vendor? vtex
? What's your VTEX app title? Product Review GraphQL Example
? What's your VTEX app description? Test description
info:    Manifest file generated succesfully!
? Choose the VTEX service you will use (Use arrow keys)
  react
❯ graphql
  Cancel

info:    vtex.product-review-graphql-example structure generated successfully.
info:    Run vtex link to start developing!
```

This will generate the following boilerplate for you:

```
product-review-graphql-example
├── graphql
│   ├── schema.graphql
├── node
│   ├── package.json
│   ├── graphql
│   │   ├── index.ts
```

# Schema definition

The schema definition is the first step for creating any GraphQL API. It should be located at `graphql/schema.graphql`.

Besides the original features from GraphQL [(check them out)](http://graphql.org/learn/queries/), VTEX IO supports a few extra that will be explained here.

## Autopersisted types

The easiest way to build a simple GraphQL API is by using autopersisted types. For example, let's say that you have a type named `Review`. You can add a directive called `@autopersist` to it, like this:

```graphql
type Review @autopersist {
  id: ID! # NOTE: Autopersisted types must have an ID
  author: String
  comment: Comment
}
```

That will automatically generate a set of CRUD queries and mutations for this type, using Masterdata for fetching and writing data. The generated queries/mutations for this example would be something like this:

```graphql
type Query {
  review(id: ID!): Review
  reviews: [Review]
}

type Mutation {
  createReview(data: CreateReviewInput): Review
  updateReview(data: ReviewInput): Review
  deleteReview(id: ID!): Boolean
}
```

That's all you need to do to have a simple working GraphQL API.

### Searchable fields

What if you need to be able to fetch reviews by author name? You can add a directive called `@searchable` for this, for example:

```graphql
type Review @autopersist {
  id: ID!
  author: String @searchable
  comment: Comment
}
```

This will add an optional `author` param to the `reviews` query, which will automatically do the desired filtering for you. This is the how the generated query will look like in this case:

```graphql
type Query {
  review(id: ID!): Review
  reviews(author: String): [Review]
}
```

## Resolver implementation

What if you need more custom behavior, instead of a just a simple CRUD?

In this case you can define your own queries or mutations. For example, let's say you want to show the number of people currently viewing the product page, and that this has custom behavior for some reason. You'd first define a query in `graphql/schema.graphql`, like this:

```graphql
type Query {
  liveViewers(productId: ID!): Int
}
```

Once it's defined, you can specify the new query's behavior in a file located at `node/graphql/index.ts` *(in the future it'll also be possible to do this in other languages besides JS)*. This file should export an object called `resolvers`, following the [usual format](https://www.apollographql.com/docs/graphql-tools/resolvers.html) for this. For example:

```js
// NOTE: Any dependencies should be defined at `node/package.json`
import random from 'random-js'

export const resolvers = {
  Query: {
    liveViewers: (root, args, context, info) => {
      /**
       * NOTE: The `productId` argument will be available inside `args`,
       * for example:
       * const {productId} = args
       */

      /**
       * NOTE: The `context` parameter has some useful data coming from VTEX IO,
       * for example:
       * const {vtex: {account, workspace}, request, response} = context
       */

      // You can do whatever you need here.
      return random().integer(1000, 10000)
    }
  },
}
```

The exact same steps will work for mutations as well.

## Cache configuration

You can use a directive called `@cacheControl` to configure how you want your types/fields to be cached. In reality this directive was created by Apollo, but VTEX IO takes advantage of it to automatically provide more caching features for you (such as CDN for React apps).

Check its usage information [here](https://www.apollographql.com/docs/engine/caching.html#cache-hints).

# Calling the API

There are different ways to call your new GraphQL API. We'll show some of them here.

## GraphiQL

[GraphiQL](https://github.com/graphql/graphiql) is a GraphQL IDE that is very helpful when testing APIs. You can access a previously configured GraphiQL for your workspace at `https://{yourWorkspace}--{yourAccount}.myvtex.com/_v/graphiqlServer`.

Note that for your API to show up there it needs to be running in that workspace, either because it's linked/installed or because some other running app depends on it.

If you check the **Docs** link in the upper right you'll see your generated queries/mutations, as well as any others you've defined yourself. Go ahead and play with them!

## React

To use an app's GraphQL inside a React app is very simple. All the details (such as the server uri, ssr data, cache, etc) are already configured for you by VTEX IO.

All you need to do is to import [`react-apollo`](https://github.com/apollographql/react-apollo) and use it with your queries. Note that you can also write your queries in separate `.graphql` files and import those in your component as well, instead of adding them as inline strings. Again, VTEX IO will take care of that behind the scenes.

An example of usage:

#### react/query.graphql
```graphql
{
  reviews {
    id
    author
    comment {
      text
    }
  }
}
```

#### react/index.js
```js
import React from 'react'
import {graphql} from 'react-apollo'
import query from './query.graphql'

const ProductReviews = ({data: {loading, reviews}}) => {
  return (
    <div>
      <h3>My Reviews</h3>
      {loading && 'Loading...'}
      {!loading && reviews.map(({id, author, {text}) => {
        return (
          <div key={id}>
            <div>{author}:</div>
            <div>{text}</div>
          </div>
        )
      })}
    </div>
  )
}

export default graphql(query)(ProductReviews)
```

## HTTP request

Finally, you can always just send an HTTP request directly to your workspace's [`graphql-server`](https://github.com/vtex/graphql-server). You can find it at:

```
http://graphql-server.vtex.${region}.vtex.io/${account}/${workspace}/graphql
```

In that case, make sure to follow the [required request format](http://graphql.org/learn/serving-over-http/#http-methods-headers-and-body). It can be a bit tricky, so in case you're calling from JS you can use the [graphql-request](https://www.npmjs.com/package/graphql-request) NPM package for that.

You're also going to need to pass the necessary credentials in the `Authorization` for this request to go through.
