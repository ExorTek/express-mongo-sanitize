import type { Application } from 'express';
import expressMongoSanitize, { ExpressMongoSanitizeOptions, ExpressMongoSanitizeError } from './index';

declare const app: Application;

app.use(expressMongoSanitize());

app.use(
  expressMongoSanitize({
    app,
    routerBasePath: 'api',
    replaceWith: 'REDACTED',
    removeMatches: true,
    sanitizeObjects: ['body', 'params', 'query'],
    mode: 'auto',
    skipRoutes: ['login'],
    customSanitizer: (data, options) => data,
    recursive: true,
    removeEmpty: true,
    patterns: [/pattern/],
    allowedKeys: ['key'],
    deniedKeys: ['key'],
    stringOptions: {
      trim: true,
      lowercase: true,
      maxLength: 10,
    },
    arrayOptions: {
      filterNull: true,
      distinct: true,
    },
  } satisfies ExpressMongoSanitizeOptions)
);

new ExpressMongoSanitizeError('message', 'type');

export { expressMongoSanitize, ExpressMongoSanitizeOptions, ExpressMongoSanitizeError };
