import { PrismaClient, Prisma } from '@prisma/client';
import RedisService, { CachePrefix } from './redis.service';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

const DASHBOARD_CACHE_TTL = parseInt(process.env.CACHE_TTL_DASHBOARD || '300');

interface DateRange {
  fromDate: Date;
  toDate: Date;
}

interface RevenueParams {
  fromDate?: string;
  toDate?: string;
  groupBy?: 'day' | 'week' | 'month' | 'year';
  salesChannel?: string;
  customerId?: number;
}

interface InventoryReportParams {
  warehouseId?: number;
  categoryId?: number;
  productType?: string;
  lowStock?: boolean;
}

class ReportService {
  // =====================================================
  // DASHBOARD COMPLETE STATS (Optimized All-in-One)
  // =====================================================
  async getDashboardStats(period: string = 'month') {
    const cacheKey = `dashboard:stats:${period}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const today = new Date();
    let periodFromDate: Date, periodToDate: Date;
    let previousFromDate: Date, previousToDate: Date;

    // Calculate period dates
    switch (period) {
      case 'week':
        periodFromDate = new Date(today);
        periodFromDate.setDate(today.getDate() - today.getDay());
        periodFromDate.setHours(0, 0, 0, 0);
        periodToDate = new Date(today.setHours(23, 59, 59, 999));

        previousFromDate = new Date(periodFromDate);
        previousFromDate.setDate(previousFromDate.getDate() - 7);
        previousToDate = new Date(periodFromDate);
        previousToDate.setHours(23, 59, 59, 999);
        previousToDate.setDate(previousToDate.getDate() - 1);
        break;

      case 'day':
        periodFromDate = new Date(today.setHours(0, 0, 0, 0));
        periodToDate = new Date(today.setHours(23, 59, 59, 999));

        previousFromDate = new Date(periodFromDate);
        previousFromDate.setDate(previousFromDate.getDate() - 1);
        previousToDate = new Date(previousFromDate);
        previousToDate.setHours(23, 59, 59, 999);
        break;

      case 'month':
      default:
        periodFromDate = new Date(today.getFullYear(), today.getMonth(), 1);
        periodToDate = new Date(today.setHours(23, 59, 59, 999));

        previousFromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        previousToDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        break;
    }

    // Fetch all data in parallel
    const [
      // KPI metrics
      revenueThisPeriod,
      revenuePreviousPeriod,
      ordersThisPeriod,
      ordersPending,
      totalInventoryValue,
      lowStockCount,
      totalReceivables,
      overdueDebtCount,
      activeProduction,

      // Charts data
      revenueTrendData,
      salesChannelsData,
      inventoryByTypeData,

      // Alerts - Low stock items
      lowStockItems,
      overdueDebts,

      // Recent data
      recentOrders,
      topProducts,
      activityLogs,
    ] = await Promise.all([
      // KPI
      this.getRevenueByPeriod(periodFromDate, periodToDate),
      this.getRevenueByPeriod(previousFromDate, previousToDate),
      this.getOrderCountByPeriod(periodFromDate, periodToDate),
      prisma.salesOrder.count({ where: { orderStatus: 'pending' } }),
      this.getTotalInventoryValue(),
      this.getLowStockCount(),
      this.getTotalReceivables(),
      this.getOverdueDebtCount(),
      prisma.productionOrder.count({ where: { status: 'in_progress' } }),

      // Charts
      this.getDashboardRevenue(period),
      this.getDashboardSalesChannels(),
      this.getDashboardInventoryByType(),

      // Alerts: Get low stock items with proper query
      prisma.inventory.findMany({
        where: {
          product: {
            minStockLevel: { gt: 0 },
            status: 'active',
          },
          quantity: {
            lt: 100, // Simplified: any stock < 100
          },
        },
        take: 3,
        include: {
          product: {
            select: { id: true, productName: true, sku: true, minStockLevel: true },
          },
          warehouse: { select: { id: true, warehouseName: true } },
        },
      }),
      prisma.customer.findMany({
        where: {
          currentDebt: { gt: 0 },
          debtUpdatedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          customerCode: true,
          customerName: true,
          currentDebt: true,
          debtUpdatedAt: true,
          phone: true,
        },
        take: 3,
        orderBy: { currentDebt: 'desc' },
      }),

      // Recent
      prisma.salesOrder.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderCode: true,
          orderDate: true,
          totalAmount: true,
          orderStatus: true,
          paymentStatus: true,
          customer: { select: { id: true, customerName: true } },
        },
      }),
      this.getDashboardTopProducts(5),
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          userId: true,
          user: { select: { fullName: true } },
          action: true,
          tableName: true,
          recordId: true,
        },
      }),
    ]);

    // Calculate trend percentage
    const revenueGrowth =
      revenuePreviousPeriod > 0
        ? ((revenueThisPeriod - revenuePreviousPeriod) / revenuePreviousPeriod) * 100
        : 0;

    // Format low stock items
    const formattedLowStockItems = lowStockItems.map((inv: any) => ({
      product_id: inv.product.id,
      product_name: inv.product.productName,
      sku: inv.product.sku,
      current_stock: Number(inv.quantity),
      min_stock: Number(inv.product.minStockLevel),
      warehouse_id: inv.warehouse.id,
      warehouse_name: inv.warehouse.warehouseName,
    }));

    // Format overdue debts
    const formattedOverdueDebts = overdueDebts.map((debt: any) => {
      const daysOverdue = Math.floor(
        (new Date().getTime() - new Date(debt.debtUpdatedAt || new Date()).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return {
        customer_id: debt.id,
        customer_name: debt.customerName,
        customer_code: debt.customerCode,
        total_debt: Number(debt.currentDebt),
        days_overdue: daysOverdue,
        phone: debt.phone,
      };
    });

    // Format activity logs
    const formattedActivityLogs = activityLogs.map((log: any) => {
      // Map action to activity type
      let activityType: 'order' | 'inventory' | 'production' | 'finance' | 'user' = 'user';

      if (log.tableName) {
        if (['sales_orders', 'deliveries'].includes(log.tableName)) {
          activityType = 'order';
        } else if (['inventory', 'stock_transactions'].includes(log.tableName)) {
          activityType = 'inventory';
        } else if (['production_orders'].includes(log.tableName)) {
          activityType = 'production';
        } else if (
          ['payment_vouchers', 'payment_receipts', 'debt_reconciliation'].includes(log.tableName)
        ) {
          activityType = 'finance';
        }
      }

      return {
        id: log.id,
        timestamp: log.createdAt,
        user_name: log.user?.fullName || 'Unknown',
        action: log.action,
        description: `${log.action} ${log.tableName}`,
        type: activityType,
      };
    });

    const result = {
      period,
      kpi: {
        revenue: {
          current: revenueThisPeriod,
          previous: revenuePreviousPeriod,
          growth_percent: Math.round(revenueGrowth * 100) / 100,
        },
        orders: {
          current: ordersThisPeriod,
          pending: ordersPending,
        },
        inventory: {
          total_value: totalInventoryValue,
          low_stock_count: lowStockCount,
        },
        debt: {
          receivables: totalReceivables,
          overdue_count: overdueDebtCount,
        },
        production: {
          active: activeProduction,
        },
      },
      charts: {
        revenue_trend: revenueTrendData.data,
        sales_channels: salesChannelsData,
        inventory_share: inventoryByTypeData,
      },
      alerts: {
        low_stock: formattedLowStockItems,
        overdue_debts: formattedOverdueDebts,
      },
      recent: {
        orders: recentOrders.map((order: any) => ({
          ...order,
          id: order.id.toString(), // Convert BigInt to string if needed
        })),
        products: topProducts,
        activities: formattedActivityLogs.map((log: any) => ({
          ...log,
          id: log.id.toString(), // Convert BigInt to string
        })),
      },
      timestamp: new Date().toISOString(),
    };

    // Convert to plain object for Redis serialization (remove BigInt fields)
    const resultForCache = JSON.parse(
      JSON.stringify(result, (_key, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      })
    );

    await redis.set(cacheKey, resultForCache, DASHBOARD_CACHE_TTL);
    return result;
  }

  // =====================================================
  // DASHBOARD METRICS
  // =====================================================
  async getDashboard() {
    const cacheKey = `${CachePrefix.DASHBOARD}overview`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    // This week
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // This month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // This year
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Last period for comparison
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);

    const [
      // Revenue metrics
      revenueToday,
      revenueThisWeek,
      revenueThisMonth,
      revenueThisYear,
      revenueLastMonth,

      // Order metrics
      ordersToday,
      ordersThisWeek,
      ordersThisMonth,
      ordersPending,
      ordersPreparing,
      ordersDelivering,

      // Inventory metrics
      totalInventoryValue,
      lowStockCount,
      expiringProductsCount,

      // Debt metrics
      totalReceivables,
      overdueDebtCount,

      // Production metrics
      productionOrdersInProgress,
    ] = await Promise.all([
      // Revenue
      this.getRevenueByPeriod(startOfToday, endOfToday),
      this.getRevenueByPeriod(startOfWeek, endOfToday),
      this.getRevenueByPeriod(startOfMonth, endOfToday),
      this.getRevenueByPeriod(startOfYear, endOfToday),
      this.getRevenueByPeriod(lastMonthStart, lastMonthEnd),

      // Orders
      this.getOrderCountByPeriod(startOfToday, endOfToday),
      this.getOrderCountByPeriod(startOfWeek, endOfToday),
      this.getOrderCountByPeriod(startOfMonth, endOfToday),
      prisma.salesOrder.count({ where: { orderStatus: 'pending' } }),
      prisma.salesOrder.count({ where: { orderStatus: 'preparing' } }),
      prisma.salesOrder.count({ where: { orderStatus: 'delivering' } }),

      // Inventory
      this.getTotalInventoryValue(),
      this.getLowStockCount(),
      this.getExpiringProductsCount(7),

      // Debt
      this.getTotalReceivables(),
      this.getOverdueDebtCount(),

      // Production
      prisma.productionOrder.count({ where: { status: 'in_progress' } }),
    ]);

    const dashboard = {
      revenue: {
        today: revenueToday,
        thisWeek: revenueThisWeek,
        thisMonth: revenueThisMonth,
        thisYear: revenueThisYear,
        lastMonth: revenueLastMonth,
        monthOverMonthGrowth:
          revenueLastMonth > 0
            ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
            : 0,
      },
      orders: {
        today: ordersToday,
        thisWeek: ordersThisWeek,
        thisMonth: ordersThisMonth,
        pending: ordersPending,
        preparing: ordersPreparing,
        delivering: ordersDelivering,
      },
      inventory: {
        totalValue: totalInventoryValue,
        lowStock: lowStockCount,
        expiringSoon: expiringProductsCount,
      },
      debt: {
        totalReceivables: totalReceivables,
        overdueCount: overdueDebtCount,
      },
      production: {
        inProgress: productionOrdersInProgress,
      },
    };

    await redis.set(cacheKey, dashboard, DASHBOARD_CACHE_TTL);
    return dashboard;
  }

  // GET /api/reports/dashboard/metrics - Dashboard metrics only
  async getDashboardMetrics() {
    const cacheKey = `${CachePrefix.DASHBOARD}metrics`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);

    const [
      revenueToday,
      revenueThisMonth,
      revenueLastMonth,
      ordersToday,
      ordersThisMonth,
      totalInventoryValue,
      lowStockCount,
      totalReceivables,
    ] = await Promise.all([
      this.getRevenueByPeriod(startOfToday, endOfToday),
      this.getRevenueByPeriod(startOfMonth, endOfToday),
      this.getRevenueByPeriod(lastMonthStart, lastMonthEnd),
      this.getOrderCountByPeriod(startOfToday, endOfToday),
      this.getOrderCountByPeriod(startOfMonth, endOfToday),
      this.getTotalInventoryValue(),
      this.getLowStockCount(),
      this.getTotalReceivables(),
    ]);

    const metrics = {
      revenue: {
        today: revenueToday,
        thisMonth: revenueThisMonth,
        lastMonth: revenueLastMonth,
        growth:
          revenueLastMonth > 0
            ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
            : 0,
      },
      orders: {
        today: ordersToday,
        thisMonth: ordersThisMonth,
      },
      inventory: {
        totalValue: totalInventoryValue,
        lowStock: lowStockCount,
      },
      debt: {
        totalReceivables,
      },
    };

    await redis.set(cacheKey, metrics, DASHBOARD_CACHE_TTL);
    return metrics;
  }

  // GET /api/reports/dashboard/revenue?period=month
  async getDashboardRevenue(period: string = 'month') {
    const cacheKey = `${CachePrefix.DASHBOARD}revenue:${period}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const today = new Date();
    let fromDate: Date;
    let toDate = new Date();

    switch (period) {
      case 'today':
        fromDate = new Date(today.setHours(0, 0, 0, 0));
        toDate = new Date(today.setHours(23, 59, 59, 999));
        break;
      case 'week':
        fromDate = new Date(today);
        fromDate.setDate(today.getDate() - today.getDay());
        fromDate.setHours(0, 0, 0, 0);
        break;
      case 'year':
        fromDate = new Date(today.getFullYear(), 0, 1);
        break;
      case 'month':
      default:
        fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
    }

    const orders = await prisma.salesOrder.findMany({
      where: {
        orderStatus: 'completed',
        completedAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      select: {
        completedAt: true,
        totalAmount: true,
      },
      orderBy: { completedAt: 'asc' },
    });

    // Group by day for charting
    const grouped = orders.reduce((acc, order) => {
      const date = new Date(order.completedAt!);
      const key = date.toISOString().split('T')[0];

      if (!acc[key]) {
        acc[key] = {
          date: key,
          revenue: 0,
        };
      }

      acc[key].revenue += Number(order.totalAmount);
      return acc;
    }, {} as Record<string, { date: string; revenue: number }>);

    const result = {
      period,
      data: Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)),
      total_revenue: orders.reduce((sum, o) => sum + Number(o.totalAmount), 0),
      total_orders: orders.length,
    };

    await redis.set(cacheKey, result, DASHBOARD_CACHE_TTL);
    return result;
  }

  // GET /api/reports/dashboard/sales-channels
  async getDashboardSalesChannels() {
    const cacheKey = `${CachePrefix.DASHBOARD}sales-channels`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const result = await this.getRevenueByChannel(
      startOfMonth.toISOString(),
      new Date().toISOString()
    );

    await redis.set(cacheKey, result, DASHBOARD_CACHE_TTL);
    return result;
  }

  // GET /api/reports/dashboard/inventory-by-type
  async getDashboardInventoryByType() {
    const cacheKey = `${CachePrefix.DASHBOARD}inventory-by-type`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.getInventoryByType();

    await redis.set(cacheKey, result, DASHBOARD_CACHE_TTL);
    return result;
  }

  // GET /api/reports/dashboard/recent-orders?limit=10
  async getDashboardRecentOrders(limit: number = 10) {
    const orders = await prisma.salesOrder.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderCode: true,
        orderDate: true,
        totalAmount: true,
        orderStatus: true,
        paymentStatus: true,
        customer: {
          select: {
            id: true,
            customerName: true,
            customerCode: true,
          },
        },
      },
    });

    return orders;
  }

  // GET /api/reports/dashboard/top-products?limit=10
  async getDashboardTopProducts(limit: number = 10) {
    const cacheKey = `${CachePrefix.DASHBOARD}top-products:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const result = await this.getTopSellingProducts(
      limit,
      startOfMonth.toISOString(),
      new Date().toISOString()
    );

    await redis.set(cacheKey, result, DASHBOARD_CACHE_TTL);
    return result;
  }

  // GET /api/reports/dashboard/overdue-debts
  async getDashboardOverdueDebts() {
    const cacheKey = `${CachePrefix.DASHBOARD}overdue-debts`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const overdueDebts = await prisma.customer.findMany({
      where: {
        currentDebt: {
          gt: 0,
        },
        debtUpdatedAt: {
          lt: thirtyDaysAgo,
        },
      },
      select: {
        id: true,
        customerCode: true,
        customerName: true,
        currentDebt: true,
        debtUpdatedAt: true,
        phone: true,
      },
      orderBy: { currentDebt: 'desc' },
      take: 10,
    });

    const result = overdueDebts.map((customer) => {
      const now = new Date();
      const debtDate = customer.debtUpdatedAt ? new Date(customer.debtUpdatedAt) : new Date();
      const daysOverdue = Math.floor((now.getTime() - debtDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        customer_id: customer.id,
        customer_name: customer.customerName,
        customer_code: customer.customerCode,
        total_debt: Number(customer.currentDebt),
        overdue_amount: Number(customer.currentDebt),
        days_overdue: daysOverdue,
        phone: customer.phone,
      };
    });

    await redis.set(cacheKey, result, DASHBOARD_CACHE_TTL);
    return result;
  }

  // =====================================================
  // REVENUE ANALYTICS
  // =====================================================
  async getRevenueReport(params: RevenueParams) {
    const { fromDate, toDate, groupBy = 'day', salesChannel, customerId } = params;

    const dateRange = this.getDateRange(fromDate, toDate);

    const where: Prisma.SalesOrderWhereInput = {
      orderStatus: 'completed',
      completedAt: {
        gte: dateRange.fromDate,
        lte: dateRange.toDate,
      },
      ...(salesChannel && { salesChannel: salesChannel as any }),
      ...(customerId && { customerId }),
    };

    const orders = await prisma.salesOrder.findMany({
      where,
      select: {
        id: true,
        orderCode: true,
        orderDate: true,
        completedAt: true,
        totalAmount: true,
        discountAmount: true,
        taxAmount: true,
        shippingFee: true,
        paidAmount: true,
        salesChannel: true,
        customer: {
          select: {
            id: true,
            customerName: true,
            classification: true,
          },
        },
      },
      orderBy: { completedAt: 'asc' },
    });

    // Group by period
    const grouped = this.groupByPeriod(orders, groupBy, 'completedAt');

    // Calculate totals
    const summary = {
      totalRevenue: orders.reduce((sum, o) => sum + Number(o.totalAmount), 0),
      totalDiscount: orders.reduce((sum, o) => sum + Number(o.discountAmount), 0),
      totalTax: orders.reduce((sum, o) => sum + Number(o.taxAmount), 0),
      totalShipping: orders.reduce((sum, o) => sum + Number(o.shippingFee), 0),
      totalPaid: orders.reduce((sum, o) => sum + Number(o.paidAmount), 0),
      orderCount: orders.length,
      averageOrderValue:
        orders.length > 0
          ? orders.reduce((sum, o) => sum + Number(o.totalAmount), 0) / orders.length
          : 0,
    };

    return {
      summary,
      data: grouped,
      period: {
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
        groupBy,
      },
    };
  }

  async getRevenueByChannel(fromDate?: string, toDate?: string) {
    const dateRange = this.getDateRange(fromDate, toDate);

    const result = await prisma.salesOrder.groupBy({
      by: ['salesChannel'],
      where: {
        orderStatus: 'completed',
        completedAt: {
          gte: dateRange.fromDate,
          lte: dateRange.toDate,
        },
      },
      _sum: {
        totalAmount: true,
        paidAmount: true,
      },
      _count: {
        id: true,
      },
    });

    return result.map((item) => ({
      channel: item.salesChannel,
      revenue: Number(item._sum.totalAmount || 0),
      paid: Number(item._sum.paidAmount || 0),
      orderCount: item._count.id,
    }));
  }

  async getRevenueByRegion(fromDate?: string, toDate?: string) {
    const dateRange = this.getDateRange(fromDate, toDate);

    const orders = await prisma.salesOrder.findMany({
      where: {
        orderStatus: 'completed',
        completedAt: {
          gte: dateRange.fromDate,
          lte: dateRange.toDate,
        },
      },
      include: {
        customer: {
          select: {
            province: true,
          },
        },
      },
    });

    const grouped = orders.reduce((acc, order) => {
      const province = order.customer.province || 'Unknown';
      if (!acc[province]) {
        acc[province] = {
          province,
          revenue: 0,
          orderCount: 0,
        };
      }
      acc[province].revenue += Number(order.totalAmount);
      acc[province].orderCount += 1;
      return acc;
    }, {} as Record<string, { province: string; revenue: number; orderCount: number }>);

    return Object.values(grouped).sort((a, b) => b.revenue - a.revenue);
  }

  // =====================================================
  // INVENTORY ANALYTICS
  // =====================================================
  async getInventoryReport(params: InventoryReportParams) {
    const { warehouseId, categoryId, productType, lowStock } = params;

    const where: Prisma.InventoryWhereInput = {
      ...(warehouseId && { warehouseId }),
      ...(productType && {
        product: {
          productType: productType as any,
        },
      }),
      ...(categoryId && {
        product: {
          categoryId,
        },
      }),
    };

    const inventory = await prisma.inventory.findMany({
      where,
      include: {
        warehouse: {
          select: {
            id: true,
            warehouseName: true,
            warehouseType: true,
          },
        },
        product: {
          select: {
            id: true,
            sku: true,
            productName: true,
            productType: true,
            unit: true,
            minStockLevel: true,
            purchasePrice: true,
            category: {
              select: {
                categoryName: true,
              },
            },
          },
        },
      },
    });

    const items = inventory.map((inv) => {
      const availableQty = Number(inv.quantity) - Number(inv.reservedQuantity);
      const value = availableQty * Number(inv.product.purchasePrice || 0);
      const isLowStock = availableQty < Number(inv.product.minStockLevel);

      return {
        warehouseId: inv.warehouseId,
        warehouseName: inv.warehouse.warehouseName,
        warehouseType: inv.warehouse.warehouseType,
        productId: inv.productId,
        sku: inv.product.sku,
        productName: inv.product.productName,
        productType: inv.product.productType,
        categoryName: inv.product.category?.categoryName,
        unit: inv.product.unit,
        quantity: Number(inv.quantity),
        reservedQuantity: Number(inv.reservedQuantity),
        availableQuantity: availableQty,
        minStockLevel: Number(inv.product.minStockLevel),
        unitPrice: Number(inv.product.purchasePrice || 0),
        totalValue: value,
        isLowStock,
      };
    });

    const filtered = lowStock ? items.filter((item) => item.isLowStock) : items;

    const summary = {
      totalItems: filtered.length,
      totalValue: filtered.reduce((sum, item) => sum + item.totalValue, 0),
      lowStockItems: filtered.filter((item) => item.isLowStock).length,
      totalQuantity: filtered.reduce((sum, item) => sum + item.availableQuantity, 0),
    };

    return {
      summary,
      data: filtered,
    };
  }

  async getInventoryByType() {
    const result = await prisma.inventory.findMany({
      include: {
        product: {
          select: {
            productType: true,
            purchasePrice: true,
          },
        },
      },
    });

    const grouped = result.reduce((acc, inv) => {
      const type = inv.product.productType;
      if (!acc[type]) {
        acc[type] = {
          productType: type,
          quantity: 0,
          value: 0,
          itemCount: 0,
        };
      }
      const qty = Number(inv.quantity) - Number(inv.reservedQuantity);
      acc[type].quantity += qty;
      acc[type].value += qty * Number(inv.product.purchasePrice || 0);
      acc[type].itemCount += 1;
      return acc;
    }, {} as Record<string, { productType: string; quantity: number; value: number; itemCount: number }>);

    return Object.values(grouped);
  }

  async getInventoryTurnover(fromDate?: string, toDate?: string) {
    const dateRange = this.getDateRange(fromDate, toDate);

    // Get stock transactions (exports) during period
    const exports = await prisma.stockTransactionDetail.findMany({
      where: {
        transaction: {
          transactionType: 'export',
          status: 'completed',
          createdAt: {
            gte: dateRange.fromDate,
            lte: dateRange.toDate,
          },
        },
      },
      include: {
        product: {
          select: {
            id: true,
            productName: true,
            sku: true,
          },
        },
      },
    });

    // Get current inventory
    const inventory = await prisma.inventory.findMany({
      include: {
        product: {
          select: {
            id: true,
            productName: true,
            sku: true,
            purchasePrice: true,
          },
        },
      },
    });

    const turnoverData = inventory.map((inv) => {
      const productExports = exports.filter((exp) => exp.productId === inv.productId);
      const totalSold = productExports.reduce((sum, exp) => sum + Number(exp.quantity), 0);
      const avgInventory = Number(inv.quantity);
      const turnoverRate = avgInventory > 0 ? totalSold / avgInventory : 0;

      return {
        productId: inv.productId,
        productName: inv.product.productName,
        sku: inv.product.sku,
        currentStock: Number(inv.quantity),
        totalSold,
        turnoverRate: Number(turnoverRate.toFixed(2)),
        daysToSell: turnoverRate > 0 ? Math.round(365 / turnoverRate) : 0,
      };
    });

    return turnoverData.sort((a, b) => b.turnoverRate - a.turnoverRate);
  }

  // =====================================================
  // SALES ANALYTICS
  // =====================================================
  async getTopSellingProducts(limit: number = 10, fromDate?: string, toDate?: string) {
    const dateRange = this.getDateRange(fromDate, toDate);

    // Get sales order details with aggregation
    const details = await prisma.salesOrderDetail.findMany({
      where: {
        order: {
          orderStatus: 'completed',
          completedAt: {
            gte: dateRange.fromDate,
            lte: dateRange.toDate,
          },
        },
      },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            productName: true,
            unit: true,
            category: {
              select: {
                categoryName: true,
              },
            },
          },
        },
      },
    });

    // Group by product manually
    const grouped = details.reduce((acc, detail) => {
      const key = detail.productId;
      if (!acc[key]) {
        acc[key] = {
          productId: detail.productId,
          productName: detail.product.productName,
          sku: detail.product.sku,
          categoryName: detail.product.category?.categoryName,
          unit: detail.product.unit,
          quantitySold: 0,
          revenue: 0,
          orderCount: 0,
        };
      }
      acc[key].quantitySold += Number(detail.quantity);
      acc[key].orderCount += 1;
      return acc;
    }, {} as Record<number, any>);

    return Object.values(grouped)
      .sort((a: any, b: any) => b.quantitySold - a.quantitySold)
      .slice(0, limit);
  }

  async getTopCustomers(limit: number = 10, fromDate?: string, toDate?: string) {
    const dateRange = this.getDateRange(fromDate, toDate);

    const result = await prisma.salesOrder.groupBy({
      by: ['customerId'],
      where: {
        orderStatus: 'completed',
        completedAt: {
          gte: dateRange.fromDate,
          lte: dateRange.toDate,
        },
      },
      _sum: {
        totalAmount: true,
        paidAmount: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          totalAmount: 'desc',
        },
      },
      take: limit,
    });

    const customerIds = result.map((r) => r.customerId);
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: {
        id: true,
        customerCode: true,
        customerName: true,
        classification: true,
        currentDebt: true,
      },
    });

    return result.map((item) => {
      const customer = customers.find((c) => c.id === item.customerId);
      return {
        customerId: item.customerId,
        customerCode: customer?.customerCode,
        customerName: customer?.customerName || 'Unknown',
        classification: customer?.classification,
        totalRevenue: Number(item._sum.totalAmount || 0),
        totalPaid: Number(item._sum.paidAmount || 0),
        orderCount: item._count.id,
        currentDebt: Number(customer?.currentDebt || 0),
      };
    });
  }

  // =====================================================
  // PRODUCTION ANALYTICS
  // =====================================================
  async getProductionReport(fromDate?: string, toDate?: string) {
    const dateRange = this.getDateRange(fromDate, toDate);

    const orders = await prisma.productionOrder.findMany({
      where: {
        status: 'completed',
        completedAt: {
          gte: dateRange.fromDate,
          lte: dateRange.toDate,
        },
      },
      include: {
        finishedProduct: {
          select: {
            productName: true,
            sku: true,
          },
        },
        materials: true,
      },
    });

    const summary = {
      totalOrders: orders.length,
      totalPlanned: orders.reduce((sum, o) => sum + Number(o.plannedQuantity), 0),
      totalProduced: orders.reduce((sum, o) => sum + Number(o.actualQuantity || 0), 0),
      totalCost: orders.reduce((sum, o) => sum + Number(o.productionCost || 0), 0),
      averageEfficiency:
        orders.length > 0
          ? orders.reduce((sum, o) => {
              const planned = Number(o.plannedQuantity);
              const actual = Number(o.actualQuantity || 0);
              return sum + (planned > 0 ? (actual / planned) * 100 : 0);
            }, 0) / orders.length
          : 0,
    };

    const details = orders.map((order) => {
      const plannedQty = Number(order.plannedQuantity);
      const actualQty = Number(order.actualQuantity || 0);
      const wastage = order.materials.reduce((sum, m) => sum + Number(m.wastage || 0), 0);

      return {
        orderCode: order.orderCode,
        productName: order.finishedProduct.productName,
        sku: order.finishedProduct.sku,
        plannedQuantity: plannedQty,
        actualQuantity: actualQty,
        efficiency: plannedQty > 0 ? (actualQty / plannedQty) * 100 : 0,
        wastage,
        cost: Number(order.productionCost || 0),
        startDate: order.startDate,
        endDate: order.endDate,
        completedAt: order.completedAt,
      };
    });

    return {
      summary,
      data: details,
    };
  }

  async getWastageReport(fromDate?: string, toDate?: string) {
    const dateRange = this.getDateRange(fromDate, toDate);

    const materials = await prisma.productionOrderMaterial.findMany({
      where: {
        productionOrder: {
          status: 'completed',
          completedAt: {
            gte: dateRange.fromDate,
            lte: dateRange.toDate,
          },
        },
        wastage: {
          gt: 0,
        },
      },
      include: {
        material: {
          select: {
            productName: true,
            sku: true,
            unit: true,
            purchasePrice: true,
          },
        },
        productionOrder: {
          select: {
            orderCode: true,
            completedAt: true,
          },
        },
      },
    });

    const grouped = materials.reduce((acc, mat) => {
      const key = mat.materialId;
      if (!acc[key]) {
        acc[key] = {
          materialId: mat.materialId,
          materialName: mat.material.productName,
          sku: mat.material.sku,
          unit: mat.material.unit,
          totalWastage: 0,
          totalCost: 0,
          occurrences: 0,
        };
      }
      const wastage = Number(mat.wastage || 0);
      acc[key].totalWastage += wastage;
      acc[key].totalCost += wastage * Number(mat.material.purchasePrice || 0);
      acc[key].occurrences += 1;
      return acc;
    }, {} as Record<number, any>);

    const result = Object.values(grouped).sort((a: any, b: any) => b.totalCost - a.totalCost);

    const summary = {
      totalWastageCost: result.reduce((sum: number, item: any) => sum + item.totalCost, 0),
      totalOccurrences: materials.length,
      affectedProducts: result.length,
    };

    return {
      summary,
      data: result,
    };
  }

  // =====================================================
  // EMPLOYEE PERFORMANCE
  // =====================================================
  async getEmployeePerformance(fromDate?: string, toDate?: string) {
    const dateRange = this.getDateRange(fromDate, toDate);

    const salesByEmployee = await prisma.salesOrder.groupBy({
      by: ['createdBy'],
      where: {
        orderStatus: 'completed',
        completedAt: {
          gte: dateRange.fromDate,
          lte: dateRange.toDate,
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    });

    const employeeIds = salesByEmployee.map((s) => s.createdBy);
    const employees = await prisma.user.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        role: {
          select: {
            roleName: true,
          },
        },
      },
    });

    return salesByEmployee
      .map((item) => {
        const employee = employees.find((e) => e.id === item.createdBy);
        return {
          employeeId: item.createdBy,
          employeeCode: employee?.employeeCode,
          fullName: employee?.fullName || 'Unknown',
          roleName: employee?.role.roleName,
          totalRevenue: Number(item._sum.totalAmount || 0),
          orderCount: item._count.id,
          averageOrderValue:
            item._count.id > 0 ? Number(item._sum.totalAmount || 0) / item._count.id : 0,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  // =====================================================
  // FINANCIAL ANALYTICS
  // =====================================================
  async getFinancialSummary(fromDate?: string, toDate?: string) {
    const dateRange = this.getDateRange(fromDate, toDate);

    const [receipts, vouchers, salesOrders] = await Promise.all([
      prisma.paymentReceipt.aggregate({
        where: {
          receiptDate: {
            gte: dateRange.fromDate,
            lte: dateRange.toDate,
          },
          approvedBy: {
            not: null,
          },
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      }),
      prisma.paymentVoucher.aggregate({
        where: {
          paymentDate: {
            gte: dateRange.fromDate,
            lte: dateRange.toDate,
          },
          approvedBy: {
            not: null,
          },
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      }),
      prisma.salesOrder.aggregate({
        where: {
          orderStatus: 'completed',
          completedAt: {
            gte: dateRange.fromDate,
            lte: dateRange.toDate,
          },
        },
        _sum: {
          totalAmount: true,
          paidAmount: true,
        },
      }),
    ]);

    const totalReceipts = Number(receipts._sum.amount || 0);
    const totalPayments = Number(vouchers._sum.amount || 0);
    const totalRevenue = Number(salesOrders._sum.totalAmount || 0);
    const totalPaid = Number(salesOrders._sum.paidAmount || 0);

    return {
      revenue: {
        total: totalRevenue,
        paid: totalPaid,
        outstanding: totalRevenue - totalPaid,
      },
      receipts: {
        total: totalReceipts,
        count: receipts._count.id,
      },
      payments: {
        total: totalPayments,
        count: vouchers._count.id,
      },
      cashFlow: {
        netCashFlow: totalReceipts - totalPayments,
        operatingCashFlow: totalPaid - totalPayments,
      },
    };
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================
  private getDateRange(fromDate?: string, toDate?: string): DateRange {
    const today = new Date();
    const from = fromDate ? new Date(fromDate) : new Date(today.getFullYear(), today.getMonth(), 1);
    const to = toDate ? new Date(toDate) : new Date(today.setHours(23, 59, 59, 999));

    return { fromDate: from, toDate: to };
  }

  private async getRevenueByPeriod(fromDate: Date, toDate: Date): Promise<number> {
    const result = await prisma.salesOrder.aggregate({
      where: {
        orderStatus: 'completed',
        completedAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      _sum: {
        totalAmount: true,
      },
    });

    return Number(result._sum.totalAmount || 0);
  }

  private async getOrderCountByPeriod(fromDate: Date, toDate: Date): Promise<number> {
    return await prisma.salesOrder.count({
      where: {
        orderStatus: 'completed',
        completedAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
    });
  }

  private async getTotalInventoryValue(): Promise<number> {
    const inventory = await prisma.inventory.findMany({
      include: {
        product: {
          select: {
            purchasePrice: true,
          },
        },
      },
    });

    return inventory.reduce((sum, inv) => {
      const qty = Number(inv.quantity) - Number(inv.reservedQuantity);
      return sum + qty * Number(inv.product.purchasePrice || 0);
    }, 0);
  }

  private async getLowStockCount(): Promise<number> {
    const inventory = await prisma.inventory.findMany({
      include: {
        product: {
          select: {
            minStockLevel: true,
          },
        },
      },
    });

    return inventory.filter((inv) => {
      const available = Number(inv.quantity) - Number(inv.reservedQuantity);
      return available < Number(inv.product.minStockLevel);
    }).length;
  }

  private async getExpiringProductsCount(days: number): Promise<number> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const items = await prisma.stockTransactionDetail.findMany({
      where: {
        expiryDate: {
          lte: futureDate,
          gt: new Date(),
        },
      },
      select: {
        productId: true,
        batchNumber: true,
      },
    });

    // Count unique combinations of productId and batchNumber
    const uniqueItems = new Set(items.map((item) => `${item.productId}-${item.batchNumber}`));
    return uniqueItems.size;
  }

  private async getTotalReceivables(): Promise<number> {
    const result = await prisma.customer.aggregate({
      where: {
        currentDebt: {
          gt: 0,
        },
      },
      _sum: {
        currentDebt: true,
      },
    });

    return Number(result._sum.currentDebt || 0);
  }

  private async getOverdueDebtCount(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return await prisma.customer.count({
      where: {
        currentDebt: {
          gt: 0,
        },
        debtUpdatedAt: {
          lt: thirtyDaysAgo,
        },
      },
    });
  }

  private groupByPeriod(
    data: any[],
    groupBy: 'day' | 'week' | 'month' | 'year',
    dateField: string
  ): any[] {
    const grouped = {} as Record<string, any>;

    data.forEach((item) => {
      const date = new Date(item[dateField]);
      let key: string;

      switch (groupBy) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = String(date.getFullYear());
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      if (!grouped[key]) {
        grouped[key] = {
          period: key,
          revenue: 0,
          discount: 0,
          tax: 0,
          shipping: 0,
          paid: 0,
          orderCount: 0,
        };
      }

      grouped[key].revenue += Number(item.totalAmount);
      grouped[key].discount += Number(item.discountAmount);
      grouped[key].tax += Number(item.taxAmount);
      grouped[key].shipping += Number(item.shippingFee);
      grouped[key].paid += Number(item.paidAmount);
      grouped[key].orderCount += 1;
    });

    return Object.values(grouped).sort((a: any, b: any) => a.period.localeCompare(b.period));
  }
}

export default new ReportService();
