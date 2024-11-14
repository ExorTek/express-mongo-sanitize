import type { Application, Router, Handler } from 'express';

export type SanitizeMode = 'auto' | 'manual';
export type SanitizeObject = 'body' | 'params' | 'query';

export interface StringSanitizeOptions {
  trim?: boolean;
  lowercase?: boolean;
  maxLength?: number | null;
}

export interface ArraySanitizeOptions {
  filterNull?: boolean;
  distinct?: boolean;
}

export interface ExpressMongoSanitizeOptions {
  /** Express application instance */
  app?: Application | null;
  /** Express router instance */
  router?: Router | null;
  /** Base path for the router */
  routerBasePath?: string | 'api';
  /** String to replace matched patterns with */
  replaceWith?: string;
  /** Whether to remove matches instead of replacing them */
  removeMatches?: boolean;
  /** Request objects to sanitize */
  sanitizeObjects?: SanitizeObject[];
  /** Sanitization mode */
  mode?: SanitizeMode;
  /** Routes to skip sanitization */
  skipRoutes?: string[];
  /** Custom sanitizer function */
  customSanitizer?: ((data: unknown, options: ExpressMongoSanitizeOptions) => unknown) | null;
  /** Whether to recursively sanitize nested objects */
  recursive?: boolean;
  /** Whether to remove empty values after sanitization */
  removeEmpty?: boolean;
  /** Patterns to match for sanitization */
  patterns?: RegExp[];
  /** Allowed keys in objects */
  allowedKeys?: string[] | null;
  /** Denied keys in objects */
  deniedKeys?: string[] | null;
  /** String sanitization options */
  stringOptions?: StringSanitizeOptions;
  /** Array sanitization options */
  arrayOptions?: ArraySanitizeOptions;
}

declare class ExpressMongoSanitizeError extends Error {
  constructor(message: string, type?: string);
  message: string;
  type: string;
}

declare const expressMongoSanitize: (options?: ExpressMongoSanitizeOptions) => Handler;

export default expressMongoSanitize;

export { ExpressMongoSanitizeError, expressMongoSanitize };
