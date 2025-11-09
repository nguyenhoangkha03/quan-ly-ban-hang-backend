import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RateLimitError } from '@utils/errors';
import { Request, Response } from 'express';
import RedisService from '@services/redis.service';
import { AuthRequest } from '@custom-types/index';

const redisClient = RedisService.getInstance();

class RedisStore {
  prefix: string;
  windowMs: number;

  constructor(windowMs: number, prefix: string = 'rate-limit') {
    this.prefix = prefix;
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime?: Date }> {
    const redisKey = `${this.prefix}:${key}`;
    const ttl = Math.ceil(this.windowMs / 1000);

    const hits = await redisClient.incr(redisKey);

    if (hits === 1) {
      await redisClient.expire(redisKey, ttl);
    }

    const remainingTtl = await redisClient.ttl(redisKey);
    const resetTime = new Date(Date.now() + remainingTtl * 1000);

    return {
      totalHits: hits,
      resetTime,
    };
  }

  async decrement(key: string): Promise<void> {
    const redisKey = `${this.prefix}:${key}`;
    await redisClient.decr(redisKey);
  }

  async resetKey(key: string): Promise<void> {
    const redisKey = `${this.prefix}:${key}`;
    await redisClient.del(redisKey);
  }
}
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, _res: Response) => {
    throw new RateLimitError('Too many requests, please slow down');
  },
  skip: (req) => {
    return req.path === '/health' || req.path === '/api/health';
  },
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req: Request, _res: Response) => {
    throw new RateLimitError('Too many login attempts, account temporarily locked');
  },
});

export const userRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1000,
  message: 'API rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    if (req.user?.id) return req.user.id.toString();
    return ipKeyGenerator(req);
  },
  handler: (_req: Request, _res: Response) => {
    throw new RateLimitError('API rate limit exceeded for this user');
  },
});

export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many file uploads',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    if (req.user?.id) return req.user.id.toString();
    return ipKeyGenerator(req);
  },
  handler: (_req: Request, _res: Response) => {
    throw new RateLimitError('File upload limit exceeded');
  },
});

export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Rate limit exceeded',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req: Request) => ipKeyGenerator(req as any)),
    handler: (_req: Request, _res: Response) => {
      throw new RateLimitError(options.message || 'Rate limit exceeded');
    },
  });
};

export const createRedisRateLimiter = (options: {
  windowMs: number;
  max: number;
  prefix?: string;
  keyGenerator?: (req: Request) => string;
}) => {
  const store = new RedisStore(options.windowMs, options.prefix);

  return async (req: AuthRequest, res: Response, next: Function) => {
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : req.user?.id?.toString() || ipKeyGenerator(req as any);

    try {
      const { totalHits, resetTime } = await store.increment(key);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', options.max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - totalHits).toString());
      if (resetTime) {
        res.setHeader('X-RateLimit-Reset', resetTime.toISOString());
      }

      if (totalHits > options.max) {
        throw new RateLimitError('Rate limit exceeded');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
