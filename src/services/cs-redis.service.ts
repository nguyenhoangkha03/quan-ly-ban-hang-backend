import RedisConfig from '@config/redis';
import { RedisClientType } from 'redis';

// =============================================================================
// 1. CẤU HÌNH TTL (THỜI GIAN SỐNG) RIÊNG CHO KHÁCH HÀNG
// =============================================================================
export const CustomerCacheTTL = {
  REFRESH_TOKEN: 30 * 24 * 60 * 60, // 30 ngày (Khách hàng cần duy trì lâu hơn)
  ACCESS_TOKEN: 15 * 60,            // 15 phút (Để blacklist)
  OTP: 5 * 60,                      // 5 phút
  RATE_LIMIT_LOGIN: 15 * 60,        // 15 phút (Khóa khi sai nhiều lần)
  PRODUCT_LIST: 5 * 60,             // 5 phút (Cache danh sách sản phẩm)
};

// =============================================================================
// 2. CẤU HÌNH PREFIX (TIỀN TỐ) ĐỂ TRÁNH TRÙNG VỚI ADMIN
// =============================================================================
export const CustomerCachePrefix = {
  SESSION: 'c_session:',       // Lưu refresh token: c_session:refresh:{accountId}
  RATE_LIMIT: 'c_ratelimit:',  // Limit login/request: c_ratelimit:login:{phone}
  BLACKLIST: 'c_blacklist:',   // Blacklist token: c_blacklist:{accessToken}
  OTP: 'c_otp:',               // OTP xác thực: c_otp:{type}:{identifier}
  CACHE: 'c_cache:',           // Cache dữ liệu chung: c_cache:products...
};

class CustomerRedisService {
  private static instance: CustomerRedisService;
  private client: RedisClientType | null = null;

  private constructor() {}

  // Singleton Instance
  public static getInstance(): CustomerRedisService {
    if (!CustomerRedisService.instance) {
      CustomerRedisService.instance = new CustomerRedisService();
    }
    return CustomerRedisService.instance;
  }

  // Lấy Client từ RedisConfig (Dùng chung kết nối với Admin để tiết kiệm resource)
  private getClient(): RedisClientType {
    if (!this.client) {
      const redisConfig = RedisConfig.getInstance();
      // Đảm bảo kết nối đã mở
      if (!redisConfig.isReady()) {
         // Trong thực tế, server đã connect lúc khởi động (file index/app.ts)
         // Dòng này chỉ để an toàn type script
         throw new Error('Redis client not connected. Ensure RedisConfig.connect() is called at startup.');
      }
      this.client = redisConfig.getClient();
    }
    return this.client;
  }

  // =====================================================
  // BASIC OPERATIONS (Wrapper)
  // =====================================================
  
  // Get value
  public async get<T = any>(key: string): Promise<T | null> {
    try {
      const client = this.getClient();
      const value = await client.get(key);
      if (!value) return null;

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error(`[CS-Redis] GET error key "${key}":`, error);
      return null;
    }
  }

  // Set value
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
      console.error(`[CS-Redis] SET error key "${key}":`, error);
      throw error;
    }
  }

  // Delete key
  public async del(keys: string | string[]): Promise<number> {
    try {
      const client = this.getClient();
      const keyArray = Array.isArray(keys) ? keys : [keys];
      if (keyArray.length === 0) return 0;
      return await client.del(keyArray);
    } catch (error) {
      console.error(`[CS-Redis] DEL error:`, error);
      throw error;
    }
  }

  // Check Exists
  public async exists(key: string): Promise<boolean> {
    try {
      const client = this.getClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      return false;
    }
  }

  // Get TTL (Time To Live)
  public async ttl(key: string): Promise<number> {
    try {
      const client = this.getClient();
      return await client.ttl(key);
    } catch (error) {
      return -2;
    }
  }

  // Increment (Dùng cho đếm số lần sai mật khẩu)
  public async incr(key: string): Promise<number> {
    try {
      const client = this.getClient();
      return await client.incr(key);
    } catch (error) {
      console.error(`[CS-Redis] INCR error:`, error);
      throw error;
    }
  }

  // Expire (Set thời gian hết hạn cho key đã có)
  public async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const client = this.getClient();
      const result = await client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      return false;
    }
  }

  // =====================================================
  // SESSION & AUTH HELPERS (Dành riêng cho Customer)
  // =====================================================

  // Lưu Refresh Token
  public async setSessionRefreshToken(accountId: number, token: string): Promise<void> {
    const key = `${CustomerCachePrefix.SESSION}refresh:${accountId}`;
    await this.set(key, token, CustomerCacheTTL.REFRESH_TOKEN);
  }

  // Lấy Refresh Token
  public async getSessionRefreshToken(accountId: number): Promise<string | null> {
    const key = `${CustomerCachePrefix.SESSION}refresh:${accountId}`;
    return await this.get<string>(key);
  }

  // Xóa Session (Đăng xuất)
  public async clearSession(accountId: number): Promise<void> {
    const key = `${CustomerCachePrefix.SESSION}refresh:${accountId}`;
    await this.del(key);
  }

  // Blacklist Access Token (Khi logout)
  public async blacklistToken(token: string): Promise<void> {
    const key = `${CustomerCachePrefix.BLACKLIST}${token}`;
    // Blacklist tồn tại bằng đúng thời gian sống của Access Token (15p)
    await this.set(key, 'true', CustomerCacheTTL.ACCESS_TOKEN);
  }

  // Kiểm tra Token có bị Blacklist không
  public async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = `${CustomerCachePrefix.BLACKLIST}${token}`;
    const result = await this.exists(key);
    return result;
  }

  // =====================================================
  // RATE LIMITER (SLIDING WINDOW)
  // Dùng cho: Login sai nhiều lần, Spam OTP
  // =====================================================
  public async checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const client = this.getClient();
    const key = `${CustomerCachePrefix.RATE_LIMIT}${identifier}`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    try {
      // 1. Xóa các request cũ ngoài khung thời gian
      await client.zRemRangeByScore(key, 0, windowStart);

      // 2. Đếm số request trong khung thời gian hiện tại
      const count = await client.zCount(key, windowStart, now);

      if (count >= maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: now + windowSeconds * 1000,
        };
      }

      // 3. Thêm request mới
      await client.zAdd(key, { score: now, value: `${now}` });
      // Set TTL cho key để tự dọn dẹp Redis
      await client.expire(key, windowSeconds);

      return {
        allowed: true,
        remaining: maxRequests - count - 1,
        resetAt: now + windowSeconds * 1000,
      };
    } catch (error) {
      console.error('[CS-Redis] Rate limit error:', error);
      // Fallback: Cho phép nếu Redis lỗi để không chặn người dùng oan
      return { allowed: true, remaining: 1, resetAt: now };
    }
  }

  // Reset Rate Limit (Dùng khi login thành công)
  public async resetRateLimit(identifier: string): Promise<void> {
    const key = `${CustomerCachePrefix.RATE_LIMIT}${identifier}`;
    await this.del(key);
  }
}

export default CustomerRedisService;