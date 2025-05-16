'use strict';

const PATTERNS = Object.freeze([/\$/g, /\./g, /\{.*\$.*\}/g]);

const DEFAULT_OPTIONS = Object.freeze({
  app: null,
  routerBasePath: 'api',
  replaceWith: '',
  sanitizeObjects: ['body', 'params', 'query'],
  mode: 'auto',
  skipRoutes: [],
  recursive: true,
  patterns: PATTERNS,
});

class ExpressMongoSanitizeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ExpressMongoSanitizeError';
  }
}

function isPlainObject(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj);
}

function validateOptions(options) {
  if (!isPlainObject(options)) return 'Options must be an object';
  if (options.app !== null && typeof options.app !== 'object') return 'app must be null or an object';
  if (options.mode && !['auto', 'manual'].includes(options.mode)) return 'mode must be "auto" or "manual"';

  return true;
}

function shouldSkipRoute(url, skipRoutes) {
  if (!skipRoutes.size) return false;

  const path = url.split('?')[0].split('#')[0];

  if (skipRoutes.has(path)) return true;

  for (const route of skipRoutes) {
    if (route.includes('*')) {
      const pattern = new RegExp('^' + route.replace(/\*/g, '.*') + '$');
      if (pattern.test(path)) return true;
    }

    if (route.includes(':')) {
      const routeParts = route.split('/');
      const pathParts = path.split('/');

      if (routeParts.length !== pathParts.length) continue;

      let match = true;
      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) continue;
        if (routeParts[i] !== pathParts[i]) {
          match = false;
          break;
        }
      }

      if (match) return true;
    }
  }

  return false;
}

function getAllRouteParams(app, basePath) {
  const params = new Set();

  const router = app._router || app.router || { stack: [] };
  if (!router.stack) return [];

  function traverseStack(stack, base) {
    for (const layer of stack) {
      if (layer.route) {
        const path = base + layer.route.path;
        const matches = path.match(/:([^/]+)/g);
        if (matches) {
          for (const match of matches) {
            params.add(match.substring(1));
          }
        }
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        let newBase = base;
        if (layer.regexp) {
          const regexStr = layer.regexp.toString();
          const match = regexStr.match(/^\/\^\\\/(?:([^\\]|\\.)*)\\\//);
          if (match) {
            newBase = base + '/' + match[1].replace(/\\\//g, '/');
          }
        }
        traverseStack(layer.handle.stack, newBase);
      }
    }
  }

  traverseStack(router.stack, basePath || '');
  return [...params];
}

function isEmail(val) {
  return typeof val === 'string' && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val);
}

function sanitizeString(str, options) {
  if (typeof str !== 'string') return str;
  if (isEmail(str)) return str;

  let result = str;

  for (const pattern of options.patterns) {
    result = result.replace(pattern, options.replaceWith);
  }

  if (options.stringOptions) {
    if (options.stringOptions.trim) {
      result = result.trim();
    }
    if (options.stringOptions.lowercase) {
      result = result.toLowerCase();
    }
    if (options.stringOptions.maxLength && result.length > options.stringOptions.maxLength) {
      result = result.slice(0, options.stringOptions.maxLength);
    }
  }

  return result;
}

function sanitizeValue(value, options) {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date
  )
    return value;

  if (isEmail(value)) return value;

  if (Array.isArray(value)) {
    let array = [...value];

    if (options.recursive) {
      array = array.map((item) => sanitizeValue(item, options, true));
    }

    if (options.arrayOptions) {
      if (options.arrayOptions.filterNull) {
        array = array.filter((item) => item !== null && item !== undefined);
      }
      if (options.arrayOptions.distinct) {
        if (array.every((item) => typeof item !== 'object' || item === null)) {
          array = [...new Set(array)];
        } else {
          const uniqueItems = [];
          const seen = new Set();

          for (const item of array) {
            const key = JSON.stringify(item);
            if (!seen.has(key)) {
              uniqueItems.push(item);
              seen.add(key);
            }
          }

          array = uniqueItems;
        }
      }
    }

    return array;
  }

  if (isPlainObject(value)) {
    const result = {};

    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith('$')) {
        continue;
      }

      let sanitizedKey = key;

      if (options.removeMatches) {
        let shouldSkip = false;
        for (const pattern of options.patterns) {
          if (pattern.test(key)) {
            shouldSkip = true;
            break;
          }
        }
        if (shouldSkip) continue;
      }

      if (options.allowedKeys && options.allowedKeys.size > 0) {
        if (!options.allowedKeys.has(key)) continue;
      }

      if (options.deniedKeys && options.deniedKeys.size > 0) {
        if (options.deniedKeys.has(key)) continue;
      }

      sanitizedKey = sanitizeString(key, options);
      if (!sanitizedKey) continue;

      let sanitizedVal = val;

      if (options.removeMatches && typeof val === 'string') {
        let shouldSkip = false;
        for (const pattern of options.patterns) {
          if (pattern.test(val)) {
            shouldSkip = true;
            break;
          }
        }
        if (shouldSkip) continue;
      }

      if (options.customSanitizer && typeof options.customSanitizer === 'function') {
        const temp = {};
        temp[key] = val;
        const customResult = options.customSanitizer(temp, options);
        sanitizedVal = customResult[key];
      } else if (options.recursive) {
        sanitizedVal = sanitizeValue(val, options, true);
      } else if (typeof val === 'string') {
        sanitizedVal = sanitizeString(val, options);
      }

      if (options.removeEmpty) {
        if (
          sanitizedVal === '' ||
          (isPlainObject(sanitizedVal) && Object.keys(sanitizedVal).length === 0) ||
          (Array.isArray(sanitizedVal) && sanitizedVal.length === 0)
        ) {
          continue;
        }
      }

      result[sanitizedKey] = sanitizedVal;
    }

    return result;
  }

  if (typeof value === 'string') return sanitizeString(value, options);

  return value;
}

function handleRequest(req, options) {
  const { sanitizeObjects } = options;
  const sanitizedObjects = {};

  for (const objName of sanitizeObjects) {
    if (!req[objName]) continue;

    const original = Object.assign({}, req[objName]);

    const keysToRemove = Object.keys(original).filter((key) => key.startsWith('$'));
    keysToRemove.forEach((key) => delete original[key]);

    const sanitized = sanitizeValue(original, options);

    if (objName === 'body' && sanitized.query && typeof sanitized.query === 'object') {
      if (
        Object.keys(sanitized.query).length === 0 ||
        Object.keys(original.query || {}).some((key) => key.startsWith('$'))
      ) {
        delete sanitized.query;
      }
    }

    try {
      if (objName === 'query' || objName === 'params') {
        Object.keys(req[objName]).forEach((key) => {
          delete req[objName][key];
        });

        Object.keys(sanitized).forEach((key) => {
          req[objName][key] = sanitized[key];
        });
      } else {
        req[objName] = sanitized;
      }

      sanitizedObjects[objName] = sanitized;
    } catch (err) {
      throw new ExpressMongoSanitizeError(`Error sanitizing ${objName}: ${err.message}`, err);
    }
  }
  return sanitizedObjects;
}

module.exports = {
  isPlainObject,
  ExpressMongoSanitizeError,
  DEFAULT_OPTIONS,
  validateOptions,
  shouldSkipRoute,
  getAllRouteParams,
  sanitizeString,
  handleRequest,
};
