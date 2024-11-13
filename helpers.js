/**
 * Checks if value is a string
 * @param {*} value - Value to check
 * @returns {boolean} True if value is string
 */
const isString = (value) => typeof value === 'string';

/**
 * Checks if value is a valid email address
 * @param {string} val - Value to check
 * @returns {boolean} True if value is a valid email address
 */
const isEmail = (val) => isString(val) && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(val);

/**
 * Checks if value is a plain object
 * @param {*} obj - Value to check
 * @returns {boolean} True if value is plain object
 */
const isPlainObject = (obj) => !!obj && Object.prototype.toString.call(obj) === '[object Object]';

const isObjectEmpty = (obj) => {
  if (!isPlainObject(obj)) return false;
  return !Object.hasOwn(obj, Object.keys(obj)[0]);
};

/**
 * Checks if value is an array
 * @param {*} value - Value to check
 * @returns {boolean} True if value is array
 */
const isArray = (value) => Array.isArray(value);

/**
 * Checks if value is a primitive (null, number, or boolean)
 * @param {*} value - Value to check
 * @returns {boolean} True if value is primitive
 */
const isPrimitive = (value) => value === null || ['number', 'boolean'].includes(typeof value);

/**
 * Checks if value is a Date object
 * @param {*} value - Value to check
 * @returns {boolean} True if value is Date
 */
const isDate = (value) => value instanceof Date;

/**
 * Checks if value is a function
 * @param {*} value - Value to check
 * @returns {boolean} True if value is function
 */
const isFunction = (value) => typeof value === 'function';

/**
 * Error class for ExpressMongoSanitize
 */
class ExpressMongoSanitizeError extends Error {
  /**
   * Creates a new ExpressMongoSanitizeError
   * @param {string} message - Error message
   * @param {string} [type='generic'] - Error type
   */
  constructor(message, type = 'generic') {
    super(message);
    this.name = 'ExpressMongoSanitizeError';
    this.type = type;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  isString,
  isEmail,
  isPlainObject,
  isObjectEmpty,
  isArray,
  isPrimitive,
  isDate,
  isFunction,
  ExpressMongoSanitizeError,
};
