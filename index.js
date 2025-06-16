'use strict';

/**
 * Regular expression patterns used for sanitizing input data.
 * These patterns match common MongoDB injection attack vectors.
 * @constant {ReadonlyArray<RegExp>}
 */
const PATTERNS = Object.freeze([
  /\$/g,
  /\./g,
  /[\\\/{}.(*+?|[\]^)]/g,
  /[\u0000-\u001F\u007F-\u009F]/g,
  /\{\s*\$|\$?\{(.|\r?\n)*\}/g,
]);

/**
 * Default configuration options for the sanitizer.
 * @constant {Object}
 * @property {string} replaceWith - String to replace sanitized content with
 * @property {boolean} removeMatches - Whether to remove matches entirely
 * @property {string[]} sanitizeObjects - Request objects to sanitize
 * @property {string} mode - Operation mode ('auto' or 'manual')
 * @property {string[]} skipRoutes - Routes to skip sanitization
 * @property {Function|null} customSanitizer - Custom sanitization function
 * @property {boolean} recursive - Whether to sanitize recursively
 * @property {boolean} removeEmpty - Whether to remove empty values
 * @property {RegExp[]} patterns - Patterns to match for sanitization
 * @property {string[]} allowedKeys - Keys that are allowed
 * @property {string[]} deniedKeys - Keys that are denied
 * @property {Object} stringOptions - String-specific options
 * @property {Object} arrayOptions - Array-specific options
 * @property {Object} debug - Debug configuration
 */
const DEFAULT_OPTIONS = Object.freeze({
  replaceWith: '',
  removeMatches: false,
  sanitizeObjects: ['body', 'query'],
  mode: 'auto',
  skipRoutes: [],
  customSanitizer: null,
  recursive: true,
  removeEmpty: false,
  patterns: PATTERNS,
  allowedKeys: [],
  deniedKeys: [],
  stringOptions: {
    trim: false,
    lowercase: false,
    maxLength: null,
  },
  arrayOptions: {
    filterNull: false,
    distinct: false,
  },
  debug: {
    enabled: false,
    level: 'info',
    logSkippedRoutes: false,
  },
});

/**
 * Log level priority mapping for filtering debug output.
 * @constant {Object<string, number>}
 */
const LOG_LEVELS = Object.freeze({
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
});

/**
 * ANSI color codes for console output formatting.
 * @constant {Object<string, string>}
 */
const LOG_COLORS = Object.freeze({
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
  trace: '\x1b[35m',
  reset: '\x1b[0m',
});

/**
 * Logs debug messages with colored output and formatting.
 * @param {Object} debugOpts - Debug configuration options
 * @param {string} level - Log level (error, warn, info, debug, trace)
 * @param {string} context - Context identifier for the log message
 * @param {string} message - Main log message
 * @param {*} [data=null] - Optional data to include in the log
 */
const log = (debugOpts, level, context, message, data = null) => {
  if (!debugOpts?.enabled || LOG_LEVELS[debugOpts.level || 'silent'] < LOG_LEVELS[level]) return;
  const color = LOG_COLORS[level] || '';
  const reset = LOG_COLORS.reset;
  const timestamp = new Date().toISOString();
  let logMessage = `${color}[mongo-sanitize:${level.toUpperCase()}]${reset} ${timestamp} [${context}] ${message}`;
  if (data !== null) {
    if (typeof data === 'object') {
      console.log(logMessage);
      console.log(`${color}Data:${reset}`, JSON.stringify(data, null, 2));
    } else {
      console.log(logMessage, data);
    }
  } else {
    console.log(logMessage);
  }
};

/**
 * Checks if a value is a string.
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a string
 */
const isString = (value) => typeof value === 'string';

/**
 * Validates if a string is a valid email address.
 * @param {*} val - Value to validate
 * @returns {boolean} True if value is a valid email
 */
const isEmail = (val) =>
  isString(val) &&
  /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i.test(
    val
  );

/**
 * Checks if a value is a plain object (not array, date, etc.).
 * @param {*} obj - Value to check
 * @returns {boolean} True if value is a plain object
 */
const isPlainObject = (obj) => !!obj && Object.prototype.toString.call(obj) === '[object Object]';

/**
 * Checks if an object is empty (has no own properties).
 * @param {*} obj - Object to check
 * @returns {boolean} True if object is empty
 */
const isObjectEmpty = (obj) => {
  if (!isPlainObject(obj)) return false;
  return !Object.hasOwn(obj, Object.keys(obj)[0]);
};

/**
 * Checks if a value is an array.
 * @param {*} value - Value to check
 * @returns {boolean} True if value is an array
 */
const isArray = (value) => Array.isArray(value);

/**
 * Checks if a value is a primitive type (null, boolean, number).
 * @param {*} value - Value to check
 * @returns {boolean} True if value is primitive
 */
const isPrimitive = (value) => value == null || typeof value === 'boolean' || typeof value === 'number';

/**
 * Checks if a value is a Date object.
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a Date
 */
const isDate = (value) => value instanceof Date;

/**
 * Checks if a value is a function.
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a function
 */
const isFunction = (value) => typeof value === 'function';

/**
 * Custom error class for express-mongo-sanitize specific errors.
 * @extends Error
 */
class ExpressMongoSanitizeError extends Error {
  /**
   * Creates a new ExpressMongoSanitizeError.
   * @param {string} message - Error message
   * @param {string} [type='generic'] - Error type identifier
   */
  constructor(message, type = 'generic') {
    super(message);
    this.name = 'ExpressMongoSanitizeError';
    this.type = type;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Sanitizes a string by removing or replacing dangerous patterns.
 * @param {string} str - String to sanitize
 * @param {Object} options - Sanitization options
 * @param {boolean} [isValue=false] - Whether this is a value (affects length limits)
 * @returns {string} Sanitized string
 */
const sanitizeString = (str, options, isValue = false) => {
  const { debug } = options;
  if (!isString(str) || isEmail(str)) {
    log(debug, 'trace', 'STRING', `Skipping: not a string or is email`, str);
    return str;
  }
  const { replaceWith, patterns, stringOptions } = options;
  const combinedPattern = new RegExp(patterns.map((pattern) => pattern.source).join('|'), 'g');
  const original = str;
  let result = str.replace(combinedPattern, replaceWith);
  if (stringOptions.trim) result = result.trim();
  if (stringOptions.lowercase) result = result.toLowerCase();
  if (stringOptions.maxLength && isValue) result = result.slice(0, stringOptions.maxLength);
  if (debug?.enabled && original !== result) {
    log(debug, 'debug', 'STRING', `Sanitized string`, { original, result });
  }
  return result;
};

/**
 * Sanitizes an array by processing each element and applying array-specific options.
 * @param {Array} arr - Array to sanitize
 * @param {Object} options - Sanitization options
 * @returns {Array} Sanitized array
 * @throws {ExpressMongoSanitizeError} If input is not an array
 */
const sanitizeArray = (arr, options) => {
  const { debug } = options;
  if (!isArray(arr)) {
    log(debug, 'error', 'ARRAY', `Input is not array`, arr);
    throw new ExpressMongoSanitizeError('Input must be an array', 'type_error');
  }
  log(debug, 'trace', 'ARRAY', `Sanitizing array of length ${arr.length}`);
  let result = arr.map((item) => sanitizeValue(item, options, true));
  if (options.arrayOptions.filterNull) {
    const before = result.length;
    result = result.filter(Boolean);
    log(debug, 'debug', 'ARRAY', `Filtered nulls: ${before} → ${result.length}`);
  }
  if (options.arrayOptions.distinct) {
    const before = result.length;
    result = [...new Set(result)];
    log(debug, 'debug', 'ARRAY', `Removed duplicates: ${before} → ${result.length}`);
  }
  return result;
};

/**
 * Sanitizes an object by processing keys and values according to configuration.
 * @param {Object} obj - Object to sanitize
 * @param {Object} options - Sanitization options
 * @returns {Object} Sanitized object
 * @throws {ExpressMongoSanitizeError} If input is not an object
 */
const sanitizeObject = (obj, options) => {
  const { debug, removeEmpty, allowedKeys, deniedKeys, removeMatches, patterns } = options;
  if (!isPlainObject(obj)) {
    log(debug, 'error', 'OBJECT', `Input is not object`, obj);
    throw new ExpressMongoSanitizeError('Input must be an object', 'type_error');
  }
  log(debug, 'trace', 'OBJECT', `Sanitizing object with keys: ${Object.keys(obj)}`);
  return Object.entries(obj).reduce((acc, [key, val]) => {
    if ((allowedKeys.size && !allowedKeys.has(key)) || deniedKeys.has(key)) {
      log(debug, 'debug', 'OBJECT', `Key '${key}' removed (allowed/denied filter)`);
      return acc;
    }
    const sanitizedKey = sanitizeString(key, options);
    if (removeMatches && patterns.some((pattern) => pattern.test(key))) {
      log(debug, 'debug', 'OBJECT', `Key '${key}' matches removal pattern`);
      return acc;
    }
    if (removeEmpty && !sanitizedKey) {
      log(debug, 'debug', 'OBJECT', `Key '${key}' removed (empty after sanitize)`);
      return acc;
    }
    if (isEmail(val) && deniedKeys.has(key)) {
      acc[sanitizedKey] = val;
      log(debug, 'trace', 'OBJECT', `Email field preserved: ${key}`);
      return acc;
    }
    if (removeMatches && isString(val) && patterns.some((pattern) => pattern.test(val))) {
      log(debug, 'debug', 'OBJECT', `Value for key '${key}' matches removal pattern`);
      return acc;
    }
    const sanitizedValue = sanitizeValue(val, options, true);
    if (!removeEmpty || sanitizedValue) acc[sanitizedKey] = sanitizedValue;
    return acc;
  }, {});
};

/**
 * Main sanitization function that routes values to appropriate sanitizers.
 * @param {*} value - Value to sanitize
 * @param {Object} options - Sanitization options
 * @param {boolean} [isValue=false] - Whether this is a value context
 * @returns {*} Sanitized value
 */
const sanitizeValue = (value, options, isValue = false) => {
  if (!value || isPrimitive(value) || isDate(value)) return value;
  if (Array.isArray(value)) return sanitizeArray(value, options);
  if (isPlainObject(value)) return sanitizeObject(value, options);
  return isString(value) ? sanitizeString(value, options, isValue) : value;
};

/**
 * Validates the provided options object against expected schema.
 * @param {Object} options - Options to validate
 * @throws {ExpressMongoSanitizeError} If any option is invalid
 */
const validateOptions = (options) => {
  const validators = {
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
      throw new ExpressMongoSanitizeError(`Invalid configuration: "${key}" with value "${options[key]}"`, 'type_error');
    }
  }
};

/**
 * Checks if a property is writable on an object or its prototype chain.
 * @param {Object} obj - Object to check
 * @param {string} prop - Property name to check
 * @returns {boolean} True if property is writable
 */
const isWritable = (obj, prop) => {
  let cur = obj;
  while (cur) {
    const descriptor = Object.getOwnPropertyDescriptor(cur, prop);
    if (descriptor) return !!descriptor.writable;
    cur = Object.getPrototypeOf(cur);
  }
  return true;
};

/**
 * Handles sanitization of Express request objects.
 * @param {Object} request - Express request object
 * @param {Object} options - Sanitization options
 */
const handleRequest = (request, options) => {
  const { sanitizeObjects, customSanitizer, debug } = options;
  log(debug, 'info', 'REQUEST', `Sanitizing request`, { url: request.originalUrl || request.url });
  sanitizeObjects.forEach((sanitizeObject) => {
    const requestObject = request[sanitizeObject];
    if (requestObject && !isObjectEmpty(requestObject)) {
      log(debug, 'debug', 'REQUEST', `Sanitizing '${sanitizeObject}'`, requestObject);
      const originalRequest = Object.assign(Array.isArray(requestObject) ? [] : {}, requestObject);
      const sanitized = customSanitizer
        ? customSanitizer(originalRequest, options)
        : sanitizeValue(originalRequest, options);
      if (debug?.enabled && JSON.stringify(originalRequest) !== JSON.stringify(sanitized)) {
        log(debug, 'debug', 'REQUEST', `'${sanitizeObject}' sanitized`, {
          before: originalRequest,
          after: sanitized,
        });
      }
      if (isWritable(request, sanitizeObject)) {
        request[sanitizeObject] = sanitized;
      } else if (typeof request[sanitizeObject] === 'object' && request[sanitizeObject] !== null) {
        Object.keys(request[sanitizeObject]).forEach((k) => delete request[sanitizeObject][k]);
        Object.assign(request[sanitizeObject], sanitized);
      }
    }
  });
};

/**
 * Cleans and normalizes a URL path for comparison.
 * @param {string} url - URL to clean
 * @returns {string|null} Cleaned URL path or null if invalid
 */
const cleanUrl = (url) => {
  if (typeof url !== 'string' || !url) return null;
  const [path] = url.split(/[?#]/);
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed ? '/' + trimmed : '/';
};

/**
 * Main middleware factory function for Express MongoDB sanitization.
 * @param {Object} [options={}] - Configuration options
 * @returns {Function} Express middleware function
 * @throws {ExpressMongoSanitizeError} If options are invalid
 */
const expressMongoSanitize = (options = {}) => {
  if (!isPlainObject(options)) throw new ExpressMongoSanitizeError('Options must be an object', 'type_error');

  const userOpts = { ...DEFAULT_OPTIONS, ...options };
  validateOptions(userOpts);

  const opts = {
    ...userOpts,
    skipRoutes: new Set(options.skipRoutes || DEFAULT_OPTIONS.skipRoutes),
    allowedKeys: new Set(options.allowedKeys || DEFAULT_OPTIONS.allowedKeys),
    deniedKeys: new Set(options.deniedKeys || DEFAULT_OPTIONS.deniedKeys),
    debug: { ...DEFAULT_OPTIONS.debug, ...(options.debug || {}) },
  };

  return (req, res, next) => {
    log(opts.debug, 'trace', 'MIDDLEWARE', `Incoming request`, { url: req.originalUrl || req.url, method: req.method });
    const cleanedRequestPath = cleanUrl(req.path || req.url);
    const shouldSkip = Array.from(opts.skipRoutes).some((skipPath) => cleanUrl(skipPath) === cleanedRequestPath);
    if (shouldSkip) {
      if (opts.debug?.logSkippedRoutes)
        log(opts.debug, 'info', 'SKIP', `Skipped route: ${req.method} ${cleanedRequestPath}`);
      return next();
    }
    if (opts.mode === 'auto') {
      log(opts.debug, 'trace', 'MIDDLEWARE', `Auto mode: running sanitizer`);
      handleRequest(req, opts);
    }
    if (opts.mode === 'manual') {
      log(opts.debug, 'trace', 'MIDDLEWARE', `Manual mode: exposing req.sanitize`);
      req.sanitize = (customOpts) => {
        const finalOpts = { ...opts, ...customOpts };
        handleRequest(req, finalOpts);
      };
    }
    next();
  };
};

/**
 * Creates a parameter sanitization handler for Express route parameters.
 * @param {Object} [options={}] - Configuration options
 * @returns {Function} Express parameter handler function
 */
const paramSanitizeHandler = (options = {}) => {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    debug: { ...DEFAULT_OPTIONS.debug, ...(options.debug || {}) },
  };
  return function (req, res, next, value, paramName) {
    const key = paramName || this?.name;
    if (key && req.params && isString(value)) {
      const before = req.params[key];
      req.params[key] = sanitizeString(value, opts, true);
      log(opts.debug, 'debug', 'PARAM', `Sanitized param '${key}'`, { before, after: req.params[key] });
    }
    next();
  };
};

module.exports = expressMongoSanitize;
module.exports.default = expressMongoSanitize;
module.exports.expressMongoSanitize = expressMongoSanitize;
module.exports.paramSanitizeHandler = paramSanitizeHandler;
exports.default = expressMongoSanitize;
