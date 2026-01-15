import RedisService, { CachePrefix, CacheTTL } from '../services/redis.service';

class CacheHelper {
  private redis: RedisService;

  constructor() {
    this.redis = RedisService.getInstance();
  }

  // =====================================================
  // SESSION CACHE
  // =====================================================
  // Store user session
  async setSession(userId: number, sessionData: any): Promise<void> {
    const key = `${CachePrefix.SESSION}${userId}`;
    await this.redis.set(key, sessionData, CacheTTL.SESSION);
  }

  // Get user session
  async getSession<T = any>(userId: number): Promise<T | null> {
    const key = `${CachePrefix.SESSION}${userId}`;
    return await this.redis.get<T>(key);
  }

  // Delete user session
  async deleteSession(userId: number): Promise<void> {
    const key = `${CachePrefix.SESSION}${userId}`;
    await this.redis.del(key);
  }

  // Extend session TTL
  async extendSession(userId: number): Promise<void> {
    const key = `${CachePrefix.SESSION}${userId}`;
    await this.redis.expire(key, CacheTTL.SESSION);
  }

  // =====================================================
  // USER CACHE
  // =====================================================
  // Cache user data
  async setUser(userId: number, userData: any): Promise<void> {
    const key = `${CachePrefix.USER}${userId}`;
    await this.redis.set(key, userData, CacheTTL.SESSION);
  }

  // Get cached user data
  async getUser<T = any>(userId: number): Promise<T | null> {
    const key = `${CachePrefix.USER}${userId}`;
    return await this.redis.get<T>(key);
  }

  // Delete user cache
  async deleteUser(userId: number): Promise<void> {
    const key = `${CachePrefix.USER}${userId}`;
    await this.redis.del(key);
  }

  // Invalidate all user caches
  async invalidateAllUsers(): Promise<number> {
    return await this.redis.flushPattern(`${CachePrefix.USER}*`);
  }

  // =====================================================
  // PRODUCT CACHE
  // =====================================================
  // Cache product data
  async setProduct(productId: number, productData: any): Promise<void> {
    const key = `${CachePrefix.PRODUCT}${productId}`;
    await this.redis.set(key, productData, CacheTTL.PRODUCTS);
  }

  // Get cached product
  async getProduct<T = any>(productId: number): Promise<T | null> {
    const key = `${CachePrefix.PRODUCT}${productId}`;
    return await this.redis.get<T>(key);
  }

  // Delete product cache
  async deleteProduct(productId: number): Promise<void> {
    const key = `${CachePrefix.PRODUCT}${productId}`;
    await this.redis.del(key);
  }

  // Cache product list
  async setProductList(cacheKey: string, products: any[]): Promise<void> {
    const key = `${CachePrefix.PRODUCT}list:${cacheKey}`;
    await this.redis.set(key, products, CacheTTL.PRODUCTS);
  }

  // Get cached product list
  async getProductList<T = any[]>(cacheKey: string): Promise<T | null> {
    const key = `${CachePrefix.PRODUCT}list:${cacheKey}`;
    return await this.redis.get<T>(key);
  }

  // Invalidate all product caches
  async invalidateAllProducts(): Promise<number> {
    return await this.redis.flushPattern(`${CachePrefix.PRODUCT}*`);
  }

  // =====================================================
  // CATEGORY CACHE
  // =====================================================
  // Cache category tree
  async setCategoryTree(categories: any[]): Promise<void> {
    const key = `${CachePrefix.CATEGORY}tree`;
    await this.redis.set(key, categories, CacheTTL.CATEGORIES);
  }

  // Get cached category tree
  async getCategoryTree<T = any[]>(): Promise<T | null> {
    const key = `${CachePrefix.CATEGORY}tree`;
    return await this.redis.get<T>(key);
  }

  // Invalidate category cache
  async invalidateCategories(): Promise<number> {
    return await this.redis.flushPattern(`${CachePrefix.CATEGORY}*`);
  }

  // =====================================================
  // INVENTORY CACHE
  // =====================================================
  // Cache inventory data
  async setInventory(warehouseId: number, productId: number, inventoryData: any): Promise<void> {
    const key = `${CachePrefix.INVENTORY}${warehouseId}:${productId}`;
    await this.redis.set(key, inventoryData, CacheTTL.INVENTORY);
  }

  // Get cached inventory
  async getInventory<T = any>(warehouseId: number, productId: number): Promise<T | null> {
    const key = `${CachePrefix.INVENTORY}${warehouseId}:${productId}`;
    return await this.redis.get<T>(key);
  }

  // Delete inventory cache
  async deleteInventory(warehouseId: number, productId?: number): Promise<void> {
    if (productId) {
      const key = `${CachePrefix.INVENTORY}${warehouseId}:${productId}`;
      await this.redis.del(key);
    } else {
      await this.redis.flushPattern(`${CachePrefix.INVENTORY}${warehouseId}:*`);
    }
  }

  // Invalidate all inventory caches
  async invalidateAllInventory(): Promise<number> {
    return await this.redis.flushPattern(`${CachePrefix.INVENTORY}*`);
  }

  // =====================================================
  // DASHBOARD CACHE
  // =====================================================
  // Cache dashboard data
  async setDashboard(userId: number, dashboardData: any): Promise<void> {
    const key = `${CachePrefix.DASHBOARD}${userId}`;
    await this.redis.set(key, dashboardData, CacheTTL.DASHBOARD);
  }

  // Get cached dashboard
  async getDashboard<T = any>(userId: number): Promise<T | null> {
    const key = `${CachePrefix.DASHBOARD}${userId}`;
    return await this.redis.get<T>(key);
  }

  // Invalidate dashboard cache
  async invalidateDashboard(userId?: number): Promise<number> {
    if (userId) {
      const key = `${CachePrefix.DASHBOARD}${userId}`;
      await this.redis.del(key);
      return 1;
    }
    return await this.redis.flushPattern(`${CachePrefix.DASHBOARD}*`);
  }

  // =====================================================
  // PERMISSION CACHE
  // =====================================================
  // Cache user permissions
  async setPermissions(userId: number, permissions: string[]): Promise<void> {
    const key = `${CachePrefix.PERMISSION}${userId}`;
    await this.redis.set(key, permissions, CacheTTL.PERMISSIONS);
  }

  // Get cached permissions
  async getPermissions(userId: number): Promise<string[] | null> {
    const key = `${CachePrefix.PERMISSION}${userId}`;
    return await this.redis.get<string[]>(key);
  }

  // Delete permission cache
  async deletePermissions(userId: number): Promise<void> {
    const key = `${CachePrefix.PERMISSION}${userId}`;
    await this.redis.del(key);
  }

  // Invalidate all permission caches
  async invalidateAllPermissions(): Promise<number> {
    return await this.redis.flushPattern(`${CachePrefix.PERMISSION}*`);
  }

  // =====================================================
  // SMART DEBT CACHE (Thêm mới)
  // =====================================================
  
  // 1. Cache Danh sách (List)
  // queryHash là chuỗi JSON của bộ lọc đã được sort (để đảm bảo tính nhất quán)
  async setDebtList(queryHash: string, data: any): Promise<void> {
    const key = `${CachePrefix.SMART_DEBT}list:${queryHash}`;
    // TTL nên để ngắn (ví dụ 5 phút) vì số liệu công nợ thay đổi liên tục
    await this.redis.set(key, data, 300); 
  }

  async getDebtList<T = any>(queryHash: string): Promise<T | null> {
    const key = `${CachePrefix.SMART_DEBT}list:${queryHash}`;
    return await this.redis.get<T>(key);
  }

  // 2. Cache Chi tiết (Detail)
  async setDebtDetail(id: number, type: string, year: number, data: any): Promise<void> {
    const key = `${CachePrefix.SMART_DEBT}detail:${type}:${id}:${year}`;
    await this.redis.set(key, data, 300);
  }

  async getDebtDetail<T = any>(id: number, type: string, year: number): Promise<T | null> {
    const key = `${CachePrefix.SMART_DEBT}detail:${type}:${id}:${year}`;
    return await this.redis.get<T>(key);
  }

  // 3. Xóa Cache (Invalidate)
  // Quan trọng: Gọi hàm này khi có lệnh Sync/Chốt sổ/Sửa giao dịch
  async invalidateSmartDebt(): Promise<number> {
    // Xóa tất cả key bắt đầu bằng prefix SMART_DEBT (cả list và detail)
    return await this.redis.flushPattern(`${CachePrefix.SMART_DEBT}*`);
  }

  // =====================================================
  // RATE LIMITING
  // =====================================================
  // Check and increment rate limit
  async checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const key = `${CachePrefix.RATE_LIMIT}${identifier}`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    try {
      await this.redis.zRemRangeByScore(key, 0, windowStart);

      const count = await this.redis.zCount(key, windowStart, now);

      if (count >= maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: now + windowSeconds * 1000,
        };
      }

      await this.redis.zAdd(key, now, `${now}`);

      await this.redis.expire(key, windowSeconds);

      return {
        allowed: true,
        remaining: maxRequests - count - 1,
        resetAt: now + windowSeconds * 1000,
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      return {
        allowed: true,
        remaining: maxRequests,
        resetAt: now + windowSeconds * 1000,
      };
    }
  }

  // Reset rate limit for identifier
  async resetRateLimit(identifier: string): Promise<void> {
    const key = `${CachePrefix.RATE_LIMIT}${identifier}`;
    await this.redis.del(key);
  }

  // =====================================================
  // GENERIC CACHE WITH PREFIX
  // =====================================================
  // Generic cache set with custom prefix
  async setCache(prefix: string, key: string, value: any, ttl?: number): Promise<void> {
    const cacheKey = `${prefix}${key}`;
    await this.redis.set(cacheKey, value, ttl);
  }

  // Generic cache get
  async getCache<T = any>(prefix: string, key: string): Promise<T | null> {
    const cacheKey = `${prefix}${key}`;
    return await this.redis.get<T>(cacheKey);
  }

  // Generic cache delete
  async deleteCache(prefix: string, key: string): Promise<void> {
    const cacheKey = `${prefix}${key}`;
    await this.redis.del(cacheKey);
  }

  // Invalidate cache by prefix
  async invalidateByPrefix(prefix: string): Promise<number> {
    return await this.redis.flushPattern(`${prefix}*`);
  }

  
}

export default CacheHelper;
