import CacheHelper from '../utils/redis.helper';

/**
 * Cache Invalidation Strategies
 *
 * Provides centralized cache invalidation logic for different entities
 * Ensures cache consistency across the application
 */

class CacheInvalidation {
  private cacheHelper: CacheHelper;

  constructor() {
    this.cacheHelper = new CacheHelper();
  }

  // =====================================================
  // USER & AUTH INVALIDATION
  // =====================================================

  /**
   * Invalidate user-related caches when user data changes
   */
  async invalidateUser(userId: number): Promise<void> {
    await Promise.all([
      this.cacheHelper.deleteUser(userId),
      this.cacheHelper.deletePermissions(userId),
      this.cacheHelper.deleteSession(userId),
      this.cacheHelper.invalidateDashboard(userId),
    ]);
  }

  /**
   * Invalidate all users cache (e.g., after bulk update)
   */
  async invalidateAllUsers(): Promise<void> {
    await this.cacheHelper.invalidateAllUsers();
  }

  /**
   * Invalidate permissions cache for a role
   */
  async invalidateRolePermissions(): Promise<void> {
    await this.cacheHelper.invalidateAllPermissions();
  }

  // =====================================================
  // PRODUCT INVALIDATION
  // =====================================================

  /**
   * Invalidate product cache when product is updated
   */
  async invalidateProduct(productId: number): Promise<void> {
    await Promise.all([
      this.cacheHelper.deleteProduct(productId),
      this.invalidateProductLists(),
    ]);
  }

  /**
   * Invalidate all product lists
   */
  async invalidateProductLists(): Promise<void> {
    await this.cacheHelper.invalidateAllProducts();
  }

  /**
   * Invalidate product and related inventory
   */
  async invalidateProductAndInventory(productId: number): Promise<void> {
    await Promise.all([
      this.cacheHelper.deleteProduct(productId),
      this.cacheHelper.invalidateAllInventory(), // Invalidate all inventory as we don't know which warehouses
    ]);
  }

  // =====================================================
  // INVENTORY INVALIDATION
  // =====================================================

  /**
   * Invalidate inventory cache for specific warehouse and product
   */
  async invalidateInventory(warehouseId: number, productId?: number): Promise<void> {
    await this.cacheHelper.deleteInventory(warehouseId, productId);
  }

  /**
   * Invalidate all inventory caches
   */
  async invalidateAllInventory(): Promise<void> {
    await this.cacheHelper.invalidateAllInventory();
  }

  /**
   * Invalidate inventory when stock transaction is created/updated
   */
  async invalidateInventoryTransaction(warehouseId: number, productIds: number[]): Promise<void> {
    const promises = productIds.map((productId) =>
      this.cacheHelper.deleteInventory(warehouseId, productId)
    );
    await Promise.all(promises);
  }

  // =====================================================
  // CATEGORY INVALIDATION
  // =====================================================

  /**
   * Invalidate category tree cache
   */
  async invalidateCategories(): Promise<void> {
    await this.cacheHelper.invalidateCategories();
  }

  // =====================================================
  // DASHBOARD INVALIDATION
  // =====================================================

  /**
   * Invalidate dashboard for specific user
   */
  async invalidateDashboard(userId?: number): Promise<void> {
    await this.cacheHelper.invalidateDashboard(userId);
  }

  /**
   * Invalidate all dashboards (e.g., after major data change)
   */
  async invalidateAllDashboards(): Promise<void> {
    await this.cacheHelper.invalidateDashboard();
  }

  // =====================================================
  // SALES ORDER INVALIDATION
  // =====================================================

  /**
   * Invalidate caches when sales order is created/updated
   */
  async invalidateSalesOrder(_customerId: number, productIds: number[], warehouseId: number): Promise<void> {
    await Promise.all([
      this.invalidateDashboard(), // Dashboard metrics affected
      ...productIds.map((productId) => this.cacheHelper.deleteInventory(warehouseId, productId)),
    ]);
  }

  // =====================================================
  // PRODUCTION ORDER INVALIDATION
  // =====================================================

  /**
   * Invalidate caches when production order is created/updated
   */
  async invalidateProductionOrder(
    materialProductIds: number[],
    finishedProductId: number,
    warehouseId: number
  ): Promise<void> {
    await Promise.all([
      this.invalidateDashboard(), // Dashboard affected
      ...materialProductIds.map((productId) => this.cacheHelper.deleteInventory(warehouseId, productId)),
      this.cacheHelper.deleteInventory(warehouseId, finishedProductId),
    ]);
  }

  // =====================================================
  // GENERIC INVALIDATION
  // =====================================================

  /**
   * Invalidate cache by custom prefix
   */
  async invalidateByPrefix(prefix: string): Promise<void> {
    await this.cacheHelper.invalidateByPrefix(prefix);
  }

  /**
   * Invalidate multiple cache types at once
   */
  async invalidateMultiple(types: Array<'user' | 'product' | 'inventory' | 'category' | 'dashboard'>): Promise<void> {
    const promises = types.map((type) => {
      switch (type) {
        case 'user':
          return this.invalidateAllUsers();
        case 'product':
          return this.invalidateProductLists();
        case 'inventory':
          return this.invalidateAllInventory();
        case 'category':
          return this.invalidateCategories();
        case 'dashboard':
          return this.invalidateAllDashboards();
        default:
          return Promise.resolve();
      }
    });

    await Promise.all(promises);
  }

  // =====================================================
  // BULK INVALIDATION (for migrations, data imports, etc.)
  // =====================================================

  /**
   * Clear all application caches (use with caution!)
   */
  async clearAllCaches(): Promise<void> {
    await Promise.all([
      this.invalidateAllUsers(),
      this.invalidateProductLists(),
      this.invalidateAllInventory(),
      this.invalidateCategories(),
      this.invalidateAllDashboards(),
      this.invalidateRolePermissions(),
    ]);
  }
}

// Export singleton instance
export const cacheInvalidation = new CacheInvalidation();
export default CacheInvalidation;
