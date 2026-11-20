// Express type extensions for properties added by Express at runtime
// These are not included in @types/express but are added by Express middleware

import type { ParsedQs } from 'qs';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { RequestHandler } from 'express-serve-static-core';

declare global {
  namespace Express {
    interface Request {
      params: ParamsDictionary;
      query: ParsedQs;
      body: unknown;
      originalUrl: string;
      method: string;
      headers: Record<string, string | string[] | undefined>;
      id: string;
      cookies: Record<string, string | undefined>;
      user?: {
        id: string;
        email: string;
        full_name: string;
        organization_id: string | null;
        is_super_admin: boolean;
      };
      accessToken?: string;
      outlet?: {
        id: string;
        organization_id: string;
        name: string;
        is_active: boolean;
        timezone: string;
      };
    }

    interface Response {
      json(body: unknown): this;
      status(code: number): this;
      send(body: unknown): this;
    }

    interface Application {
      use(handler: RequestHandler): this;
      use(path: string, handler: RequestHandler): this;
    }
  }
}

export {};
