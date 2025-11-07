import RedisConfig from '@config/redis';
import { RedisClientType } from 'redis';

// Cache strategies and TTL constants
export const CacheTTL = {
  SESSION: 24 * 60 * 60,
  PRODUCTS: 60 * 60,
  CATEGORIES: 60 * 60,
  INVENTORY: 5 * 60,
  DASHBOARD: 5 * 60,
  PERMISSIONS: 60 * 60,
  RATE_LIMIT: 60,
};

// Cache key prefixes
export const CachePrefix = {
  SESSION: 'session:',
  USER: 'user:',
  PRODUCT: 'product:',
  CATEGORY: 'category:',
  INVENTORY: 'inventory:',
  DASHBOARD: 'dashboard:',
  PERMISSION: 'permission:',
  RATE_LIMIT: 'rate_limit:',
};

class RedisService {
  private static instance: RedisService;
  private client: RedisClientType | null = null;

  private constructor() {}

  // Get singleton instance
  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }

    return RedisService.instance;
  }

  // Initialize Redis client
  public async initialize(): Promise<void> {
    const redisConfig = RedisConfig.getInstance();
    await redisConfig.connect();
    this.client = redisConfig.getClient();
  }

  // Get Redis Client
  private getClient(): RedisClientType {
    if (!this.client) {
      throw new Error('Redis client not initialized. Call initialize() first.');
    }

    return this.client;
  }

  // =====================================================
  // BASIC OPERATIONS
  // =====================================================
  // Get value by key
  public async get<T = any>(key: string): Promise<T | null> {
    try {
      const client = this.getClient();
      const value = await client.get(key);

      if (!value) {
        return null;
      }

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error(`Redis GET error for key "${key}":`, error);
      return null;
    }
  }

  // Set value with optional TTL
  public async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const client = this.getClient();
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

      if (ttl) {
        await client.setEx(key, ttl, serializedValue);
      } else {
        await client.set(key, serializedValue);
      }
    } catch (error) {
      console.error(`Redis SET error for key "${key}":`, error);
      throw error;
    }
  }

  // Delete one or more keys
  public async del(keys: string | string[]): Promise<number> {
    try {
      const client = this.getClient();
      const keyArray = Array.isArray(keys) ? keys : [keys];
      return await client.del(keyArray);
    } catch (error) {
      console.error(`Redis DEL error for keys:`, keys, error);
      throw error;
    }
  }

  // Check if key exists
  public async exists(key: string): Promise<boolean> {
    try {
      const client = this.getClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis EXISTS error for key "${key}":`, error);
      return false;
    }
  }

  // Set expiration time for a key
  public async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const client = this.getClient();
      const result = await client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      console.error(`Redis EXPIRE error for key "${key}":`, error);
      return false;
    }
  }

  // Get remaining TTL for a key
  public async ttl(key: string): Promise<number> {
    try {
      const client = this.getClient();
      return await client.ttl(key);
    } catch (error) {
      console.error(`Redis TTL error for key "${key}":`, error);
      return -2;
    }
  }

  // =====================================================
  // PATTERN OPERATIONS
  // =====================================================
  // Flush all keys matching a pattern
  public async flushPattern(pattern: string): Promise<number> {
    try {
      const client = this.getClient();
      const keys: string[] = [];

      for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        if (typeof key === 'string') {
          keys.push(key);
        }
      }

      if (keys.length === 0) return 0;

      const flatKeys = keys.flat();

      return await client.del(flatKeys);
    } catch (error) {
      console.error(`Redis FLUSH_PATTERN error for pattern "${pattern}":`, error);
      throw error;
    }
  }

  // Get all keys matching a pattern
  public async keys(pattern: string): Promise<string[]> {
    try {
      const client = this.getClient();
      const keys: string[] = [];

      for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        keys.push(key as unknown as string);
      }

      return keys;
    } catch (error) {
      console.error(`Redis KEYS error for pattern "${pattern}":`, error);
      return [];
    }
  }

  // =====================================================
  // HASH OPERATIONS
  // =====================================================
  // Set hash field
  public async hSet(key: string, field: string, value: any): Promise<number> {
    try {
      const client = this.getClient();
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      return await client.hSet(key, field, serializedValue);
    } catch (error) {
      console.error(`Redis HSET error for key "${key}", field "${field}":`, error);
      throw error;
    }
  }

  // Get hash field
  public async hGet<T = any>(key: string, field: string): Promise<T | null> {
    try {
      const client = this.getClient();
      const value = await client.hGet(key, field);

      if (!value) {
        return null;
      }

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error(`Redis HGET error for key "${key}", field "${field}":`, error);
      return null;
    }
  }

  // Get all hash fields
  public async hGetAll<T = Record<string, any>>(key: string): Promise<T | null> {
    try {
      const client = this.getClient();
      const data = await client.hGetAll(key);

      if (!data || Object.keys(data).length === 0) {
        return null;
      }

      const parsed: Record<string, any> = {};
      for (const [field, value] of Object.entries(data)) {
        try {
          parsed[field] = JSON.parse(value);
        } catch {
          parsed[field] = value;
        }
      }

      return parsed as T;
    } catch (error) {
      console.error(`Redis HGETALL error for key "${key}":`, error);
      return null;
    }
  }

  // Delete hash field
  public async hDel(key: string, field: string | string[]): Promise<number> {
    try {
      const client = this.getClient();
      const fields = Array.isArray(field) ? field : [field];
      return await client.hDel(key, fields);
    } catch (error) {
      console.error(`Redis HDEL error for key "${key}":`, error);
      throw error;
    }
  }

  // =====================================================
  // LIST OPERATIONS
  // =====================================================
  // Push to list (left)
  public async lPush(key: string, ...values: any[]): Promise<number> {
    try {
      const client = this.getClient();
      const serialized = values.map((v) => (typeof v === 'string' ? v : JSON.stringify(v)));
      return await client.lPush(key, serialized);
    } catch (error) {
      console.error(`Redis LPUSH error for key "${key}":`, error);
      throw error;
    }
  }

  // Get list range
  public async lRange<T = any>(key: string, start: number, stop: number): Promise<T[]> {
    try {
      const client = this.getClient();
      const values = await client.lRange(key, start, stop);

      return values.map((v) => {
        try {
          return JSON.parse(v) as T;
        } catch {
          return v as T;
        }
      });
    } catch (error) {
      console.error(`Redis LRANGE error for key "${key}":`, error);
      return [];
    }
  }

  // =====================================================
  // SET OPERATIONS
  // =====================================================
  // Add members to set
  public async sAdd(key: string, ...members: any[]): Promise<number> {
    try {
      const client = this.getClient();
      const serialized = members.map((m) => (typeof m === 'string' ? m : JSON.stringify(m)));
      return await client.sAdd(key, serialized);
    } catch (error) {
      console.error(`Redis SADD error for key "${key}":`, error);
      throw error;
    }
  }

  // Check if member exists in set
  public async sIsMember(key: string, member: any): Promise<boolean> {
    try {
      const client = this.getClient();
      const serialized = typeof member === 'string' ? member : JSON.stringify(member);
      const result = await client.sIsMember(key, serialized);
      return result === 1;
    } catch (error) {
      console.error(`Redis SISMEMBER error for key "${key}":`, error);
      return false;
    }
  }

  // Get all members of set
  public async sMembers<T = any>(key: string): Promise<T[]> {
    try {
      const client = this.getClient();
      const members = await client.sMembers(key);

      return members.map((m) => {
        try {
          return JSON.parse(m) as T;
        } catch {
          return m as T;
        }
      });
    } catch (error) {
      console.error(`Redis SMEMBERS error for key "${key}":`, error);
      return [];
    }
  }

  // =====================================================
  // SORTED SET OPERATIONS (for rate limiting)
  // =====================================================
  // Add member to sorted set
  public async zAdd(key: string, score: number, member: string): Promise<number> {
    try {
      const client = this.getClient();
      return await client.zAdd(key, { score, value: member });
    } catch (error) {
      console.error(`Redis ZADD error for key "${key}":`, error);
      throw error;
    }
  }

  // Count members in sorted set within score range
  public async zCount(key: string, min: number, max: number): Promise<number> {
    try {
      const client = this.getClient();
      return await client.zCount(key, min, max);
    } catch (error) {
      console.error(`Redis ZCOUNT error for key "${key}":`, error);
      return 0;
    }
  }

  // Remove members from sorted set by score range
  public async zRemRangeByScore(key: string, min: number, max: number): Promise<number> {
    try {
      const client = this.getClient();
      return await client.zRemRangeByScore(key, min, max);
    } catch (error) {
      console.error(`Redis ZREMRANGEBYSCORE error for key "${key}":`, error);
      return 0;
    }
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================
  // Increment value
  public async incr(key: string, amount: number = 1): Promise<number> {
    try {
      const client = this.getClient();
      if (amount === 1) {
        return await client.incr(key);
      }
      return await client.incrBy(key, amount);
    } catch (error) {
      console.error(`Redis INCR error for key "${key}":`, error);
      throw error;
    }
  }

  // Decrement value
  public async decr(key: string, amount: number = 1): Promise<number> {
    try {
      const client = this.getClient();
      if (amount === 1) {
        return await client.decr(key);
      }
      return await client.decrBy(key, amount);
    } catch (error) {
      console.error(`Redis DECR error for key "${key}":`, error);
      throw error;
    }
  }

  // Flush all data in current database
  public async flushDb(): Promise<void> {
    try {
      const client = this.getClient();
      await client.flushDb();
      console.log('✅ Redis database flushed');
    } catch (error) {
      console.error('Redis FLUSHDB error:', error);
      throw error;
    }
  }

  // Get info about Redis server
  public async info(): Promise<string> {
    try {
      const client = this.getClient();
      return await client.info();
    } catch (error) {
      console.error('Redis INFO error:', error);
      throw error;
    }
  }

  // Ping Redis server
  public async ping(): Promise<string> {
    try {
      const client = this.getClient();
      return await client.ping();
    } catch (error) {
      console.error('Redis PING error:', error);
      throw error;
    }
  }
}

export default RedisService;
