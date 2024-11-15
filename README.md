# @exortek/express-mongo-sanitize

A middleware designed for sanitizing incoming requests to an Express application, particularly when working with
MongoDB (NoSQL). It ensures that certain patterns, such as special characters or malicious input, are removed or
replaced from the request body, query, and parameters, preventing potential injection attacks in NoSQL.

### Key Features

- Automatic sanitization of potentially dangerous MongoDB operators and special characters.
- Multiple operation modes (auto, manual)
- Customizable sanitization patterns and replacement strategies
- Support for nested objects and arrays
- Configurable string and array handling options
- Skip routes functionality
- Custom sanitizer support
- Email address preservation during sanitization
- Option to remove matched patterns entirely
- Enhanced security with request object cloning

## Installation

```bash
npm install @exortek/express-mongo-sanitize
```

OR

```bash
yarn add @exortek/express-mongo-sanitize
```

## Usage

Register the middleware in your Express application before defining your routes.

### App route example

```javascript

const express = require('express');
const expressMongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();

app.use(exppress.json());

// Register the middleware
app.use(expressMongoSanitize());

// Define your routes
app.get('/users', (req, res) => {
  // Your route logic here
});

app.post('/users', (req, res) => {
  // Your route logic here
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});

```

### Route-specific example

```javascript

const express = require('express');
const expressMongoSanitize = require('@exortek/express-mongo-sanitize');
const router = require('./router');

const app = express();

app.use(express.json());

// Register the middleware
app.use(expressMongoSanitize());

// Define your routes
app.use('/api', router);

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});

```

# Configuration Options

The middleware accepts various configuration options to customize its behavior. Here's a detailed breakdown of all
available
options:

## Core Options

| Option            | Type           | Default                                            | Description                                                                                                                                                                                                                                                                               |
|-------------------|----------------|----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app`             | Application    | `null`                                             | The Express app instance. Default is null. You can specify the app instance if you want to sanitize the params(Path variables) of the app.                                                                                                                                                |
| `router`          | Router         | `null`                                             | The Express router instance. Default is null. You can specify the router instance if you want to sanitize the params(Path variables) of the router.                                                                                                                                       |
| `routerBasePath`  | string         | `api`                                              | // The base path of the router. Default is an 'api'. You can specify the base path of the router.                                                                                                                                                                                         |
| `replaceWith`     | string         | `''`                                               | The string to replace the matched patterns with. Default is an empty string. If you want to replace the matched patterns with a different string, you can set this option.                                                                                                                |
| `removeMatches`   | boolean        | `false`                                            | Remove the matched patterns. Default is false. If you want to remove the matched patterns instead of replacing them, you can set this option to true.                                                                                                                                     |
| `sanitizeObjects` | array          | `['body', 'params', 'query']`                      | The request properties to sanitize. Default is `['body', 'params', 'query']`. You can specify any request property that you want to sanitize. It must be an object.                                                                                                                       |
| `mode`            | string         | `'auto'`                                           | The mode of operation. Default is 'auto'. You can set this option to 'auto', 'manual'. If you set it to 'auto', the plugin will automatically sanitize the request objects. If you set it to 'manual', you can sanitize the request objects manually using the request.sanitize() method. |
| `skipRoutes`      | array          | `[]`                                               | An array of routes to skip. Default is an empty array. If you want to skip certain routes from sanitization, you can specify the routes here. The routes must be in the format `/path`. For example, `['/health', '/metrics']`.                                                           |
| `customSanitizer` | function\|null | `null`                                             | A custom sanitizer function. Default is null. If you want to use a custom sanitizer function, you can specify it here. The function must accept two arguments: the original data and the options object. It must return the sanitized data.                                               |
| `recursive`       | boolean        | `true`                                             | Enable recursive sanitization. Default is true. If you want to recursively sanitize the nested objects, you can set this option to true.                                                                                                                                                  |
| `removeEmpty`     | boolean        | `false`                                            | Remove empty values. Default is false. If you want to remove empty values after sanitization, you can set this option to true.                                                                                                                                                            |
| `patterns`        | array          | `PATTERNS`                                         | An array of patterns to match. Default is an array of patterns that match illegal characters and sequences. You can specify your own patterns if you want to match different characters or sequences. Each pattern must be a regular expression.                                          |
| `allowedKeys`     | array\|null    | `null`                                             | An array of allowed keys. Default is null. If you want to allow only certain keys in the object, you can specify the keys here. The keys must be strings. If a key is not in the allowedKeys array, it will be removed.                                                                   |
| `deniedKeys`      | array\|null    | `null`                                             | An array of denied keys. Default is null. If you want to deny certain keys in the object, you can specify the keys here. The keys must be strings. If a key is in the deniedKeys array, it will be removed.                                                                               |
| `stringOptions`   | object         | `{ trim: false,lowercase: false,maxLength: null }` | An object that controls string sanitization behavior. Default is an empty object. You can specify the following options: `trim`, `lowercase`, `maxLength`.                                                                                                                                |
| `arrayOptions`    | object         | `{ filterNull: false, distinct: false}`            | An object that controls array sanitization behavior. Default is an empty object. You can specify the following options: `filterNull`, `distinct`.                                                                                                                                         |    

## String Options

The `stringOptions` object controls string sanitization behavior:

```javascript
{
  trim: false,      // Whether to trim whitespace from start/end
  lowercase: false, // Whether to convert strings to lowercase
  maxLength: null   // Maximum allowed string length (null for no limit)
}
```

## Array Options

The `arrayOptions` object controls array sanitization behavior:

```javascript
{
  filterNull: false, // Whether to remove null/undefined values
  distinct: false    // Whether to remove duplicate values
}
```

## Example Configuration

Here's an example of how you can configure the middleware with custom options:

```javascript
app.use(expressMongoSanitize({
    app: app,
    router: router,
    routerBasePath: 'api',
    replaceWith: 'REPLACED',
    removeMatches: false,
    sanitizeObjects: ['body', 'params', 'query'],
    mode: 'auto',
    skipRoutes: ['/health', '/metrics'],
    customSanitizer: (data, options) => {
      // Custom sanitizer logic here
      return data;
    },
    recursive: true,
    removeEmpty: false,
    patterns: [/pattern1/, /pattern2/],
    allowedKeys: ['key1', 'key2'],
    deniedKeys: ['key3', 'key4'],
    stringOptions: {
      trim: true,
      lowercase: true,
      maxLength: 100
    },
    arrayOptions: {
      filterNull: true,
      distinct: true
    }
}));
```

## Notes

- The middleware is designed to work with Express applications and is not compatible with other frameworks.
- If the app or router instances are not provided to the `@exortek/express-mongo-sanitize` middleware, the route parameters (path variables) cannot be sanitized. The middleware will skip sanitizing the route parameters and display a warning message indicating that sanitization was not performed for the path variables. Ensure that both the app and router instances are properly passed to the middleware to enable route parameter sanitization.
- All options are optional and will use their default values if not specified.
- Custom patterns must be valid RegExp objects

## License

**[MIT](https://github.com/ExorTek/express-mongo-sanitize/blob/master/LICENSE)**<br>

Copyright © 2024 ExorTek
