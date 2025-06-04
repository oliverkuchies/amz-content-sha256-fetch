# amz-content-sha256
Fetch with automatically embedded amz-content-sha256 header to comply with AWS CloudFront requirements when enabling OAC.

Supports:
- File Requests
- Apollo GraphQL Requests
- Standard Fetch Requests

How to use:

```javascript
import { fetchSha256 } from "amz-content-sha256-fetch";

const url = 'https://example.mangos'
const body = { key: 'bobs-bananas', 'mango': 'fruit' }

const options = {
    method: 'POST',
    url: url,
    body: JSON.stringify(body),
    headers: {
        'Content-Type': 'application/json'
    }
}

await fetchSha256(options)
```

If you wish to use the hash function without the fetch, you can use the `mutateBody` function:

```javascript
import { sha256 } from "amz-content-sha256-fetch";

const hashedBody = await mutateBody(body)

const headers = {
    ...otherHeaders,
    'Content-Type': 'application/json',
    'x-amz-content-sha256': hashedBody
}
```

If you wish to mutate the headers to include the hash, you can use the `mutateHeaders` function
    
```javascript
import { mutateHeaders } from "amz-content-sha256-fetch";

let headers = {
    ...otherHeaders,
    'Content-Type': 'application/json'
}

headers = mutateHeaders(headers, body)
```

If you wish to implement the hash with Apollo GraphQL Client, you can do the following:

```javascript
import { print } from 'graphql/language/printer';
import { mutateHeaders } from 'amz-content-sha256-fetch';
import { ApolloProvider, ApolloClient, InMemoryCache, ApolloLink, HttpLink } from '@apollo/client';

const awsHashInterceptor = new ApolloLink((operation, forward) => {
    const request = {
      operationName: operation.operationName,
      variables: operation.variables,
      query: print(operation.query).replace(/\n/g, '\n'),
    };

    const existingHeaders = operation.getContext().headers;

    operation.setContext({
      headers: {
        ...mutateHeaders(existingHeaders, request),
      },
    });

    return forward(operation);
  });


  const httpLink = new HttpLink({ uri: '/graphql' });
  const client = new ApolloClient({
    link: ApolloLink.from([awsHashInterceptor, httpLink]), 
    cache: new InMemoryCache({
      addTypename: false
    }),
  });

    return (
    <ApolloProvider client={client}>
      <App />   
    </ApolloProvider>
);

## File Uploads

If you are uploading a file, you can do so with the following:

```javascript
const formData = new FormData();
formData.append('file', currentFile);
fetchSha256('https://mysite.com', {
  method: 'POST',
  body: formData,
  credentials: 'include'
})
```

This will generate the appropriate aws hash header.