# @exortek/express-mongo-sanitize

A comprehensive Express middleware designed to protect your No(n)SQL queries from injection attacks by sanitizing request data.  
This middleware provides flexible sanitization options for request bodies and query strings, and an **optional handler for route parameters**.

## Compatibility

| Middleware version | Express version |
|--------------------|:---------------:|
| `^1.x`             |     `^4.x`      |
| `^1.x`             |     `^5.x`      |

## Features

- Automatic sanitization of `req.body` and `req.query` by default
- Supports deep/nested objects, arrays, and string transformation
- Allows custom sanitizer logic, key allow/deny lists, skip routes, and more
- **Route params (`req.params`) can be sanitized with an explicit helper** (see below)

---

## Installation

```sh
yarn add @exortek/express-mongo-sanitize
# or
npm install @exortek/express-mongo-sanitize
```

---

## Usage

### Basic usage

```js
const express = require('express');
const expressMongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());

// Body and query are sanitized automatically:
app.use(expressMongoSanitize());

app.post('/submit', (req, res) => {
  res.json(req.body);
});
```

---

### Sanitizing Route Params (`req.params`)

By default, only `body` and `query` are sanitized.  
**If you want to sanitize route parameters (`req.params`),**  
use the exported `paramSanitizeHandler` with Express's `app.param` or `router.param`:

```js
// Route parameter sanitization (recommended way):
app.param('username', expressMongoSanitize.paramSanitizeHandler());

// Example route:
app.get('/user/:username', (req, res) => {
  res.json({ username: req.params.username });
});
```

**Note:**
- You can attach this for any route param, e.g. `'id'`, `'slug'`, etc.
- This gives you full control and doesn't require the middleware to know your routes.

---

## Options

| Option            | Type     | Default                             | Description                                                         |
|-------------------|----------|-------------------------------------|---------------------------------------------------------------------|
| `replaceWith`     | string   | `''`                                | String to replace matched patterns                                  |
| `removeMatches`   | boolean  | `false`                             | Remove values matching patterns entirely                            |
| `sanitizeObjects` | string[] | `['body', 'query']`                 | List of request objects to sanitize                                 |
| `mode`            | string   | `'auto'`                            | `'auto'` for automatic, `'manual'` for explicit req.sanitize() call |
| `skipRoutes`      | string[] | `[]`                                | List of paths to skip (e.g. ['/health'])                            |
| `customSanitizer` | function | `null`                              | Custom sanitizer function, overrides built-in sanitizer             |
| `recursive`       | boolean  | `true`                              | Recursively sanitize nested values                                  |
| `removeEmpty`     | boolean  | `false`                             | Remove empty values after sanitization                              |
| `patterns`        | RegExp[] | See source code                     | Patterns to match for sanitization                                  |
| `allowedKeys`     | string[] | `[]`                                | Only allow these keys (all if empty)                                |
| `deniedKeys`      | string[] | `[]`                                | Remove these keys (none if empty)                                   |
| `stringOptions`   | object   | See below                           | String transform options (trim, lowercase, maxLength)               |
| `arrayOptions`    | object   | See below                           | Array handling options (filterNull, distinct)                       |
| `debug`           | object   | `{ enabled: false, level: "info" }` | Enables debug logging for middleware internals.                     |


#### `stringOptions` default:

```js
{
  trim: false,
  lowercase: false,
  maxLength: null
}
```

#### `arrayOptions` default:

```js
{
  filterNull: false,
  distinct: false
}
```

---

## Manual Mode

If you set `mode: 'manual'`, the middleware will not sanitize automatically.  
Call `req.sanitize()` manually in your route:

```js
app.use(expressMongoSanitize({ mode: 'manual' }));

app.post('/manual', (req, res) => {
  req.sanitize({ replaceWith: '_' }); // custom options are supported here
  res.json(req.body);
});
```

---

## Skipping Routes

Skip certain routes by adding their paths to `skipRoutes`:

```js
app.use(expressMongoSanitize({ skipRoutes: ['/skip', '/status'] }));

// These routes will NOT be sanitized
```

---

## Custom Sanitizer

Use a completely custom sanitizer function:

```js
app.use(expressMongoSanitize({
  customSanitizer: (data, options) => {
    // Your custom logic
    return data;
  }
}));
```

---

## Route Parameter Sanitization

> By default, only `body` and `query` are sanitized.
> If you want to sanitize route parameters (`req.params`),  
> use the helper function with `app.param` or `router.param`:
>
> ```js
> app.param('username', expressMongoSanitize.paramSanitizeHandler());
> ```
>
> This ensures that, for example, `/user/$admin` will be returned as `{ username: 'admin' }`  
> in your handler.

---

## TypeScript

Type definitions are included.  
You can use this plugin in both CommonJS and ESM projects.

---

## Advanced Usage

### Custom Sanitizer per Route

You can override sanitizer options or use a completely custom sanitizer per route:

```js
app.post('/profile', (req, res, next) => {
  req.sanitize({
    customSanitizer: (data) => {
      // For example, redact all strings:
      if (typeof data === 'string') return '[REDACTED]';
      return data;
    }
  });
  res.json(req.body);
});
```
## Debugging & Logging

You can enable debug logs to see the internal operation of the middleware.  
Useful for troubleshooting or when tuning sanitization behavior.

```js
app.use(
  expressMongoSanitize({
    debug: {
      enabled: true,         // Turn on debug logs
      level: 'debug',        // Log level: 'error' | 'warn' | 'info' | 'debug' | 'trace'
      logSkippedRoutes: true // (optional) Log when routes are skipped
    },
    // ...other options
  })
);
```
### Logging Levels
| Level   | Description                          |
|---------|--------------------------------------|
| `error` | Logs only errors                     |
| `warn`  | Logs warnings and errors             |
| `info`  | Logs informational messages          |
| `debug` | Logs detailed debug information      |
| `trace` | Logs very detailed trace information |

### Using with Router

```js
const router = express.Router();
router.use(expressMongoSanitize());
// You can use paramSanitizeHandler on router params as well:
router.param('userId', expressMongoSanitize.paramSanitizeHandler());
```

---

## Troubleshooting

### Route parameters are not being sanitized

By default, only `body` and `query` are sanitized.  
To sanitize route parameters, use:

```js
app.param('username', expressMongoSanitize.paramSanitizeHandler());
```

### Skipping specific routes doesn't work as expected

Make sure you use the exact path as in your route definition,  
and that you apply the middleware before your routes.

---

### My request is not being sanitized

- Ensure your route handler is after the middleware in the stack.
- If you are using `mode: 'manual'`, you **must** call `req.sanitize()` yourself.

---

For more troubleshooting, open an issue at [Github Issues](https://github.com/ExorTek/express-mongo-sanitize/issues)

---

## License

**[MIT](https://github.com/ExorTek/express-mongo-sanitize/blob/master/LICENSE)**<br>

Copyright © 2025 ExorTek
