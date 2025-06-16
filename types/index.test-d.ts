import type { Application } from 'express';
import expressMongoSanitize, { ExpressMongoSanitizeOptions } from './';

declare const app: Application;

app.use(expressMongoSanitize());

app.use(
  expressMongoSanitize({
    replaceWith: 'REDACTED',
    removeMatches: true,
    sanitizeObjects: ['body', 'query'],
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
    debug: {
      enabled: true,
      level: 'info',
    },
  } satisfies ExpressMongoSanitizeOptions)
);

export { expressMongoSanitize, ExpressMongoSanitizeOptions };
