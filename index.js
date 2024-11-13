'use strict';
const {
  isPlainObject,
  isString,
  isFunction,
  isArray,
  isPrimitive,
  isDate,
  isObjectEmpty,
  ExpressMongoSanitizeError,
  isEmail,
} = require('./helpers');

/**
 * Collection of regular expression patterns used for sanitization
 * @constant {RegExp[]}
 */
const PATTERNS = Object.freeze([
  /[\$]/g, // Finds all '$' (dollar) characters in the text.
  /\./g, // Finds all '.' (dot) characters in the text.
  /[\\\/{}.(*+?|[\]^)]/g, // Finds special characters (\, /, {, }, (, ., *, +, ?, |, [, ], ^, )) that need to be escaped.
  /[\u0000-\u001F\u007F-\u009F]/g, // Finds ASCII control characters (0x00-0x1F and 0x7F-0x9F range).
  /\{\s*\$|\$?\{(.|\r?\n)*\}/g, // Finds placeholders or variables in the format `${...}` or `{ $... }`.
]);

/**
 * Default configuration options for the plugin
 * @constant {Object}
 */
const DEFAULT_OPTIONS = Object.freeze({
  app: null, // The Express app instance. Default is null. You can specify the app instance if you want to sanitize the request objects globally.
  router: null, // The Express router instance. Default is null. You can specify the router instance if you want to sanitize the request objects for a specific router.
  routerBasePath: 'api', // The base path of the router. Default is an empty string. You can specify the base path of the router if you want to sanitize the path variables.
  replaceWith: '', // The string to replace the matched patterns with. Default is an empty string. If you want to replace the matched patterns with a different string, you can set this option.
  removeMatches: false, // Remove the matched patterns. Default is false. If you want to remove the matched patterns instead of replacing them, you can set this option to true.
  sanitizeObjects: ['body', 'params', 'query'], // The request properties to sanitize. Default is ['body', 'params', 'query']. You can specify any request property that you want to sanitize. It must be an object.
  mode: 'auto', // The mode of operation. Default is 'auto'. You can set this option to 'auto', 'manual'. If you set it to 'auto', the plugin will automatically sanitize the request objects. If you set it to 'manual', you can sanitize the request objects manually using the request.sanitize() method.
  skipRoutes: [], // An array of routes to skip. Default is an empty array. If you want to skip certain routes from sanitization, you can specify the routes here. The routes must be in the format '/path'. For example, ['/health', '/metrics'].
  customSanitizer: null, // A custom sanitizer function. Default is null. If you want to use a custom sanitizer function, you can specify it here. The function must accept two arguments: the original data and the options object. It must return the sanitized data.
  recursive: true, // Enable recursive sanitization. Default is true. If you want to recursively sanitize the nested objects, you can set this option to true.
  removeEmpty: false, // Remove empty values. Default is false. If you want to remove empty values after sanitization, you can set this option to true.
  patterns: PATTERNS, // An array of patterns to match. Default is an array of patterns that match illegal characters and sequences. You can specify your own patterns if you want to match different characters or sequences. Each pattern must be a regular expression.
  allowedKeys: [], // An array of allowed keys. Default is array. If you want to allow only certain keys in the object, you can specify the keys here. The keys must be strings. If a key is not in the allowedKeys array, it will be removed.
  deniedKeys: [], // An array of denied keys. Default is array. If you want to deny certain keys in the object, you can specify the keys here. The keys must be strings. If a key is in the deniedKeys array, it will be removed.
  stringOptions: {
    // String sanitization options.
    trim: false, // Trim whitespace. Default is false. If you want to trim leading and trailing whitespace from the string, you can set this option to true.
    lowercase: false, // Convert to lowercase. Default is false. If you want to convert the string to lowercase, you can set this option to true.
    maxLength: null, // Maximum length. Default is null. If you want to limit the maximum length of the string, you can set this option to a number. If the string length exceeds the maximum length, it will be truncated.
  },
  arrayOptions: {
    // Array sanitization options.
    filterNull: false, // Filter null values. Default is false. If you want to remove null values from the array, you can set this option to true.
    distinct: false, // Remove duplicate values. Default is false. If you want to remove duplicate values from the array, you can set this option to true.
  },
});

/**
 * Sanitizes a string value according to provided options
 * @param {string} str - String to sanitize
 * @param {Object} options - Sanitization options
 * @param {boolean} isValue - Whether string is a value or key
 * @returns {string} Sanitized string
 */
const sanitizeString = (str, options, isValue = false) => {
  if (!isString(str) || isEmail(str)) return str;

  const { replaceWith, patterns, stringOptions } = options;

  let result = patterns.reduce((acc, pattern) => acc.replace(pattern, replaceWith), str);

  if (stringOptions.trim) result = result.trim();
  if (stringOptions.lowercase) result = result.toLowerCase();
  if (stringOptions.maxLength && isValue) result = result.slice(0, stringOptions.maxLength);

  return result;
};

/**
 * Sanitizes an array according to provided options
 * @param {Array} arr - Array to sanitize
 * @param {Object} options - Sanitization options
 * @returns {Array} Sanitized array
 * @throws {ExpressMongoSanitizeError} If input is not an array
 */
const sanitizeArray = (arr, options) => {
  if (!isArray(arr)) throw new ExpressMongoSanitizeError('Input must be an array', 'type_error');

  const { arrayOptions } = options;
  let result = arr.map((item) => sanitizeValue(item, options, true));

  if (arrayOptions.filterNull) result = result.filter(Boolean);
  if (arrayOptions.distinct) result = [...new Set(result)];
  return result;
};

/**
 * Sanitizes an object according to provided options
 * @param {Object} obj - Object to sanitize
 * @param {Object} options - Sanitization options
 * @returns {Object} Sanitized object
 * @throws {ExpressMongoSanitizeError} If input is not an object
 */
const sanitizeObject = (obj, options) => {
  if (!isPlainObject(obj)) throw new ExpressMongoSanitizeError('Input must be an object', 'type_error');

  const { removeEmpty, allowedKeys, deniedKeys, removeMatches, patterns } = options;
  return Object.entries(obj).reduce((acc, [key, val]) => {
    if ((allowedKeys.size && !allowedKeys.has(key)) || deniedKeys.has(key)) return acc;

    const sanitizedKey = sanitizeString(key, options);
    if (removeMatches && patterns.some((pattern) => pattern.test(key))) return acc;
    if (removeEmpty && !sanitizedKey) return acc;

    if (isEmail(val)) {
      acc[sanitizedKey] = val;
      return acc;
    }

    if (removeMatches && isString(val) && patterns.some((pattern) => pattern.test(val))) return acc;

    const sanitizedValue = sanitizeValue(val, options, true);
    if (!removeEmpty || sanitizedValue) acc[sanitizedKey] = sanitizedValue;

    return acc;
  }, {});
};

/**
 * Sanitizes a value according to its type and provided options
 * @param {*} value - Value to sanitize
 * @param {Object} options - Sanitization options
 * @param {boolean} [isValue=false] - Whether value is a value or key
 * @returns {*} Sanitized value
 */
const sanitizeValue = (value, options, isValue = false) => {
  if (!value || isPrimitive(value) || isDate(value)) return value;
  if (Array.isArray(value)) return sanitizeArray(value, options);
  if (isPlainObject(value)) return sanitizeObject(value, options);
  return isString(value) ? sanitizeString(value, options, isValue) : value;
};

/**
 * Validates plugin options
 * @param {Object} options - Options to validate
 * @throws {ExpressMongoSanitizeError} If any option is invalid
 */
const validateOptions = (options) => {
  const validators = {
    app: (value) => !value || isFunction(value),
    router: (value) => !value || isFunction(value),
    routerBasePath: isString,
    replaceWith: isString,
    removeMatches: isPrimitive,
    sanitizeObjects: isArray,
    mode: (value) => ['auto', 'manual'].includes(value),
    skipRoutes: isArray,
    customSanitizer: (value) => value === null || isFunction(value),
    recursive: isPrimitive,
    removeEmpty: isPrimitive,
    patterns: isArray,
    allowedKeys: (value) => value === null || isArray(value),
    deniedKeys: (value) => value === null || isArray(value),
    stringOptions: isPlainObject,
    arrayOptions: isPlainObject,
  };

  for (const [key, validate] of Object.entries(validators)) {
    if (!validate(options[key])) {
      throw new ExpressMongoSanitizeError(`Invalid configuration: ${key}`, 'type_error');
    }
  }
};

/**
 * Handles request sanitization
 * @param {Object} request - Express request object
 * @param {Object} options - Sanitization options
 */
const handleRequest = (request, options) => {
  const { sanitizeObjects, customSanitizer } = options;

  for (const sanitizeObject of sanitizeObjects) {
    const requestObject = request[sanitizeObject];

    if (requestObject && isObjectEmpty(requestObject)) {
      const originalRequest = Object.assign({}, requestObject);

      request[sanitizeObject] = customSanitizer
        ? customSanitizer(originalRequest)
        : sanitizeValue(originalRequest, options);
    }
  }
};

/**
 * Get all route parameters from the Express app
 * @param {Object[]} stack - Express app stack
 * @param {string} basePath - Base path of the router
 * @returns {string[]} All route parameters in the Express app
 */
const getAllRouteParams = (stack, basePath) => {
  const uniqueParams = new Set();
  const pathStack = [{ currentStack: stack, basePath: basePath }];

  while (pathStack.length > 0) {
    const { currentStack, basePath } = pathStack.pop();

    for (let i = 0; i < currentStack.length; i++) {
      const middleware = currentStack[i];

      if (middleware.route) {
        const routePath = basePath + middleware.route.path;
        const paramRegex = /:([^/]+)/g;
        let paramMatch;

        while ((paramMatch = paramRegex.exec(routePath))) {
          uniqueParams.add(paramMatch[1]);
        }
      } else if (middleware.name === 'router' && middleware.handle?.stack) {
        let newBasePath = '';

        if (middleware.regexp) {
          const regexpStr = middleware.regexp.toString();
          const match = regexpStr.match(/^\/\^\\\/\?((?:[^\\]|\\.)*)\\\/\?\$\/$/);

          if (match?.[1]) {
            newBasePath = match[1].replace(/\\\//g, '/');
          }
        }

        pathStack.push({
          currentStack: middleware.handle.stack,
          basePath: basePath + newBasePath,
        });
      }
    }
  }

  return [...uniqueParams];
};

/**
 * Express middleware for sanitizing request objects
 * @param {Object} [options={}] - Configuration options
 * @returns {Function} Express middleware function
 * @throws {ExpressMongoSanitizeError} If options are invalid
 */
const expressMongoSanitize = (options = {}) => {
  if (!isPlainObject(options)) throw new ExpressMongoSanitizeError('Options must be an object', 'type_error');

  const userOpts = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  validateOptions(userOpts);

  const opts = {
    ...userOpts,
    skipRoutes: new Set(options.skipRoutes || DEFAULT_OPTIONS.skipRoutes),
    allowedKeys: new Set(options.allowedKeys || DEFAULT_OPTIONS.allowedKeys),
    deniedKeys: new Set(options.deniedKeys || DEFAULT_OPTIONS.deniedKeys),
  };

  const { mode, app, router, routerBasePath } = opts;

  return (req, res, next) => {
    if (opts.skipRoutes.has(req.url)) return next();

    if (app) {
      const allRouteParams = getAllRouteParams(app._router.stack, routerBasePath);
      app.param(allRouteParams, (req, res, next, value, name) => {
        req.params[name] = sanitizeString(value, opts);
        next();
      });
    }

    if (router) {
      const allRouteParams = getAllRouteParams(app._router.stack, routerBasePath);
      while (allRouteParams.length) {
        const param = allRouteParams.pop();
        router.param(param, (req, res, next, value, name) => {
          req.params[name] = sanitizeString(value, opts);
          next();
        });
      }
    }

    if (mode === 'auto') {
      handleRequest(req, opts);
    }

    if (mode === 'manual') {
      req.sanitize = (customOpts) => {
        const finalOpts = { ...opts, ...customOpts };
        handleRequest(req, finalOpts);
      };
    }

    next();
  };
};

module.exports = expressMongoSanitize;
module.exports.default = expressMongoSanitize;
module.exports.expressMongoSanitize = expressMongoSanitize;