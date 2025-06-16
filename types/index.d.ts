import { RequestHandler, RequestParamHandler } from 'express';

/**
 * String-specific sanitizer options.
 */
export interface StringOptions {
  /** Trim whitespace from strings */
  trim?: boolean;
  /** Convert strings to lowercase */
  lowercase?: boolean;
  /** Truncate strings to a maximum length (null = unlimited) */
  maxLength?: number | null;
}

/**
 * Array-specific sanitizer options.
 */
export interface ArrayOptions {
  /** Remove null values from arrays */
  filterNull?: boolean;
  /** Remove duplicate values from arrays */
  distinct?: boolean;
}

export interface DebugOptions {
  /** Enable debug logging */
  enabled?: boolean;
  /** Log level (e.g., 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace') */
  level?: string;
}

/**
 * Main options for expressMongoSanitize middleware.
 */
export interface ExpressMongoSanitizeOptions {
  /** String to replace matched patterns with */
  replaceWith?: string;
  /** Remove values matching patterns */
  removeMatches?: boolean;
  /** Request objects to sanitize (default: ['body', 'query']) */
  sanitizeObjects?: Array<'body' | 'query'>;
  /** Automatic or manual mode */
  mode?: 'auto' | 'manual';
  /** Paths to skip sanitizing */
  skipRoutes?: string[];
  /** Completely custom sanitizer function */
  customSanitizer?: (data: any, options: ExpressMongoSanitizeOptions) => any;
  /** Recursively sanitize nested objects */
  recursive?: boolean;
  /** Remove empty values after sanitizing */
  removeEmpty?: boolean;
  /** Patterns to match for sanitization */
  patterns?: RegExp[];
  /** Only allow these keys in sanitized objects */
  allowedKeys?: string[];
  /** Remove these keys from sanitized objects */
  deniedKeys?: string[];
  /** String sanitizer options */
  stringOptions?: StringOptions;
  /** Array sanitizer options */
  arrayOptions?: ArrayOptions;
  /** Debugging options */
  debug?: DebugOptions;
}

/**
 * Middleware for automatic sanitization of request objects.
 */
declare function expressMongoSanitize(options?: ExpressMongoSanitizeOptions): RequestHandler;

/**
 * Middleware for sanitizing individual route parameters.
 */
declare function paramSanitizeHandler(options?: ExpressMongoSanitizeOptions): RequestParamHandler;

/**
 * Main export for express-mongo-sanitize middleware.
 */
export default expressMongoSanitize;
export { expressMongoSanitize, paramSanitizeHandler };
