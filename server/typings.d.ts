// CJS module overrides — these packages export a function via module.exports but their
// TypeScript declarations use named ESM exports, which confuses require() type inference.

declare module 'helmet' {
  import { RequestHandler } from 'express';
  function helmet(options?: Record<string, unknown>): RequestHandler;
  export = helmet;
}

declare module 'express-rate-limit' {
  import { RequestHandler } from 'express';
  function rateLimit(options?: Record<string, unknown>): RequestHandler;
  export = rateLimit;
}

declare module 'stripe' {
  function Stripe(secretKey: string, options?: Record<string, unknown>): any;
  export = Stripe;
}
