'use strict';

const {
  isPlainObject,
  ExpressMongoSanitizeError,
  DEFAULT_OPTIONS,
  validateOptions,
  shouldSkipRoute,
  getAllRouteParams,
  sanitizeString,
  handleRequest,
} = require('./helpers');

function expressMongoSanitize(options = {}) {
  if (!isPlainObject(options)) throw new ExpressMongoSanitizeError('Options must be an object');

  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const validationResult = validateOptions(mergedOptions);
  if (validationResult !== true) {
    throw new ExpressMongoSanitizeError(
      'Invalid options provided. Please check the documentation for valid options.',
      validationResult
    );
  }

  const opts = {
    ...mergedOptions,
    skipRoutes: new Set(options.skipRoutes || []),
    allowedKeys: new Set(options.allowedKeys || []),
    deniedKeys: new Set(options.deniedKeys || []),
  };

  if (opts.app) {
    const params = getAllRouteParams(opts.app, opts.routerBasePath);
    params.forEach((param) => {
      opts.app.param(param, (req, res, next, value, name) => {
        if (req.params && req.params[name]) {
          req.params[name] = sanitizeString(value, opts);
        }
        next();
      });
    });
  } else {
    throw new ExpressMongoSanitizeError('Express app instance is required! Please provide it in the options.');
  }

  return (req, res, next) => {
    if (shouldSkipRoute(req.url, opts.skipRoutes)) return next();

    if (opts.mode === 'auto') handleRequest(req, opts);

    if (opts.mode === 'manual') {
      req.sanitize = (customOpts = {}) => {
        const customOptions = {
          ...opts,
          ...customOpts,
          skipRoutes: new Set(customOpts.skipRoutes || []),
          allowedKeys: new Set(customOpts.allowedKeys || []),
          deniedKeys: new Set(customOpts.deniedKeys || []),
        };
        return handleRequest(req, customOptions);
      };
    }

    next();
  };
}

module.exports = expressMongoSanitize;
module.exports.default = expressMongoSanitize;
module.exports.expressMongoSanitize = expressMongoSanitize;
