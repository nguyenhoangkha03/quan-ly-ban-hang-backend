import { Request, Response } from 'express';
import {
  getRecentMetrics,
  getSlowRequests,
  getAverageResponseTime,
  getMetricsSummary,
  clearMetrics,
} from '@utils/performance.monitor';
import { getDatabaseMetrics } from '@config/prisma';
import RedisService from '@services/redis.service';

/**
 * Performance Monitoring Controller
 *
 * Provides endpoints to monitor application performance:
 * - Request metrics
 * - Slow requests
 * - Database health
 * - Redis cache stats
 * - Memory usage
 */

class PerformanceController {
  /**
   * Get performance metrics summary
   * GET /api/performance/metrics
   */
  async getMetrics(_req: Request, res: Response): Promise<void> {
    try {
      const summary = getMetricsSummary();

      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve performance metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get recent request metrics
   * GET /api/performance/recent?limit=100
   */
  async getRecentRequests(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 100;
      const metrics = getRecentMetrics(limit);

      res.json({
        success: true,
        data: {
          count: metrics.length,
          metrics,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve recent requests',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get slow requests
   * GET /api/performance/slow?threshold=1000
   */
  async getSlowRequestsList(req: Request, res: Response): Promise<void> {
    try {
      const threshold = parseInt(req.query.threshold as string, 10) || 1000;
      const slowRequests = getSlowRequests(threshold);

      res.json({
        success: true,
        data: {
          threshold: `${threshold}ms`,
          count: slowRequests.length,
          requests: slowRequests,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve slow requests',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get system health check
   * GET /api/performance/health
   */
  async healthCheck(_req: Request, res: Response): Promise<void> {
    try {
      // Check database
      const dbMetrics = await getDatabaseMetrics();

      // Check Redis
      let redisConnected = false;
      try {
        const redis = RedisService.getInstance();
        const ping = await redis.ping();
        redisConnected = ping === 'PONG';
      } catch (error) {
        redisConnected = false;
      }

      // Memory usage
      const memoryUsage = process.memoryUsage();
      const memory = {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      };

      // Uptime
      const uptime = process.uptime();
      const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

      const status = dbMetrics.connected && redisConnected ? 'healthy' : 'degraded';

      res.status(dbMetrics.connected ? 200 : 503).json({
        success: true,
        data: {
          status,
          timestamp: new Date().toISOString(),
          uptime: uptimeFormatted,
          services: {
            database: {
              connected: dbMetrics.connected,
              status: dbMetrics.connected ? 'ok' : 'error',
            },
            redis: {
              connected: redisConnected,
              status: redisConnected ? 'ok' : 'error',
            },
          },
          memory,
          performance: {
            avgResponseTime: `${getAverageResponseTime()}ms`,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get cache statistics
   * GET /api/performance/cache-stats
   */
  async getCacheStats(_req: Request, res: Response): Promise<void> {
    try {
      const redis = RedisService.getInstance();

      // Get Redis info
      const info = await redis.info();

      // Parse relevant stats from info string
      const stats = {
        connected: true,
        info: info.split('\n').filter(line =>
          line.includes('connected_clients') ||
          line.includes('used_memory_human') ||
          line.includes('keyspace_hits') ||
          line.includes('keyspace_misses')
        ).reduce((acc, line) => {
          const [key, value] = line.split(':');
          if (key && value) {
            acc[key.trim()] = value.trim();
          }
          return acc;
        }, {} as Record<string, string>),
      };

      // Calculate hit rate if available
      const hits = parseInt(stats.info.keyspace_hits || '0', 10);
      const misses = parseInt(stats.info.keyspace_misses || '0', 10);
      const total = hits + misses;
      const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) : '0';

      res.json({
        success: true,
        data: {
          ...stats,
          hitRate: `${hitRate}%`,
          hits,
          misses,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve cache stats',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Clear performance metrics (admin only)
   * POST /api/performance/clear
   */
  async clearPerformanceMetrics(_req: Request, res: Response): Promise<void> {
    try {
      clearMetrics();

      res.json({
        success: true,
        message: 'Performance metrics cleared successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to clear metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export default new PerformanceController();
