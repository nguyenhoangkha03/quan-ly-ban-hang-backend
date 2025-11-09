import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '@utils/errors';
import { asyncHandler } from './errorHandler';

// Simple validate for body/query/params (default: body)
export const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = req[source];
      const validated = await schema.parseAsync(data);

      req[source] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const zodError = error as any;
        const details =
          zodError.errors?.map((err: any) => ({
            field: err.path?.join('.') || 'unknown',
            message: err.message,
            code: err.code,
          })) || [];

        throw new ValidationError('Validation failed', details);
      }
      throw error;
    }
  });
};

// Validate with nested structure (body, query, params) - for user module
export const validateNested = (schema: ZodSchema) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Parse the entire request with nested structure
      const validated: any = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Update request with validated data
      if (validated.body !== undefined) Object.assign(req.body, validated.body);
      if (validated.query !== undefined) Object.assign(req.query, validated.query);
      if (validated.params !== undefined) Object.assign(req.params, validated.params);

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const zodError = error as any;
        const details =
          zodError.errors?.map((err: any) => ({
            field: err.path?.join('.') || 'unknown',
            message: err.message,
            code: err.code,
          })) || [];

        throw new ValidationError('Validation failed', details);
      }
      throw error;
    }
  });
};

export const validateMultiple = (schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const errors: any[] = [];

    try {
      if (schemas.body) {
        try {
          req.body = await schemas.body.parseAsync(req.body);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...(error as any).errors.map((e: any) => ({ source: 'body', ...e })));
          }
        }
      }

      if (schemas.query) {
        try {
          req.query = (await schemas.query.parseAsync(req.query)) as any;
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...(error as any).errors.map((e: any) => ({ source: 'query', ...e })));
          }
        }
      }

      if (schemas.params) {
        try {
          req.params = (await schemas.params.parseAsync(req.params)) as any;
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...(error as any).errors.map((e: any) => ({ source: 'params', ...e })));
          }
        }
      }

      if (errors.length > 0) {
        const details = errors.map((err) => ({
          source: err.source,
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        throw new ValidationError('Validation failed', details);
      }

      next();
    } catch (error) {
      throw error;
    }
  });
};

export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .trim();
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }

    return obj;
  };

  if (req.body) Object.assign(req.body, sanitize(req.body));
  if (req.query) Object.assign(req.query, sanitize(req.query));
  if (req.params) Object.assign(req.params, sanitize(req.params));

  next();
};
