import { Request, Response, NextFunction } from 'express';
import logger from './logger';

export interface PerformanceMetrics {
  requestId: string;
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userId?: number;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}

// Configuration
const SLOW_REQUEST_THRESHOLD = parseInt(process.env.SLOW_REQUEST_THRESHOLD || '1000', 10); // 1 second default
const LOG_ALL_REQUESTS = process.env.LOG_ALL_REQUESTS === 'true';
const TRACK_MEMORY = process.env.TRACK_MEMORY === 'true';

// In-memory storage for metrics (for development)
const performanceMetrics: PerformanceMetrics[] = [];
const MAX_METRICS_STORAGE = 1000;

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current memory usage
 */
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    rss: Math.round(usage.rss / 1024 / 1024), // MB
  };
}

/**
 * Store metrics in memory
 */
function storeMetrics(metrics: PerformanceMetrics): void {
  performanceMetrics.push(metrics);

  // Keep only last N metrics to prevent memory leak
  if (performanceMetrics.length > MAX_METRICS_STORAGE) {
    performanceMetrics.shift();
  }
}

/**
 * Performance Monitoring Middleware
 */
export function performanceMonitor(req: Request, res: Response, next: NextFunction): void {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const startMemory = TRACK_MEMORY ? getMemoryUsage() : undefined;

  // Attach request ID to request object
  (req as any).requestId = requestId;

  // Override res.json to capture response time
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Build metrics object
    const metrics: PerformanceMetrics = {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode,
      responseTime,
      timestamp: new Date(),
      userId: (req as any).user?.id,
      memoryUsage: TRACK_MEMORY ? getMemoryUsage() : undefined,
    };

    // Log slow requests
    if (responseTime > SLOW_REQUEST_THRESHOLD) {
      logger.warn('Slow request detected', {
        ...metrics,
        threshold: SLOW_REQUEST_THRESHOLD,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
    }

    // Log all requests if enabled
    if (LOG_ALL_REQUESTS) {
      logger.info('Request completed', metrics);
    }

    // Store metrics
    storeMetrics(metrics);

    // Memory leak warning
    if (startMemory && metrics.memoryUsage) {
      const heapGrowth = metrics.memoryUsage.heapUsed - startMemory.heapUsed;
      if (heapGrowth > 100) {
        // More than 100MB growth
        logger.warn('Large memory growth detected', {
          requestId,
          url: req.originalUrl,
          heapGrowth: `${heapGrowth}MB`,
          before: startMemory,
          after: metrics.memoryUsage,
        });
      }
    }

    return originalJson(body);
  };

  next();
}

/**
 * Get recent performance metrics
 */
export function getRecentMetrics(limit: number = 100): PerformanceMetrics[] {
  return performanceMetrics.slice(-limit);
}

/**
 * Get slow requests
 */
export function getSlowRequests(threshold: number = SLOW_REQUEST_THRESHOLD): PerformanceMetrics[] {
  return performanceMetrics.filter((m) => m.responseTime > threshold);
}

/**
 * Get average response time
 */
export function getAverageResponseTime(): number {
  if (performanceMetrics.length === 0) return 0;

  const total = performanceMetrics.reduce((sum, m) => sum + m.responseTime, 0);
  return Math.round(total / performanceMetrics.length);
}

/**
 * Get metrics summary
 */
export function getMetricsSummary() {
  const totalRequests = performanceMetrics.length;
  const slowRequests = getSlowRequests();
  const avgResponseTime = getAverageResponseTime();

  // Group by endpoint
  const endpointStats: Record<string, { count: number; avgTime: number; maxTime: number }> = {};

  performanceMetrics.forEach((m) => {
    const endpoint = `${m.method} ${m.url.split('?')[0]}`; // Remove query params

    if (!endpointStats[endpoint]) {
      endpointStats[endpoint] = { count: 0, avgTime: 0, maxTime: 0 };
    }

    endpointStats[endpoint].count++;
    endpointStats[endpoint].avgTime += m.responseTime;
    endpointStats[endpoint].maxTime = Math.max(endpointStats[endpoint].maxTime, m.responseTime);
  });

  // Calculate averages
  Object.keys(endpointStats).forEach((endpoint) => {
    endpointStats[endpoint].avgTime = Math.round(
      endpointStats[endpoint].avgTime / endpointStats[endpoint].count
    );
  });

  // Sort by slowest
  const slowestEndpoints = Object.entries(endpointStats)
    .sort((a, b) => b[1].avgTime - a[1].avgTime)
    .slice(0, 10)
    .map(([endpoint, stats]) => ({ endpoint, ...stats }));

  return {
    totalRequests,
    slowRequestsCount: slowRequests.length,
    slowRequestsPercentage:
      totalRequests > 0 ? Math.round((slowRequests.length / totalRequests) * 100) : 0,
    avgResponseTime,
    slowestEndpoints,
    memoryUsage: TRACK_MEMORY ? getMemoryUsage() : null,
  };
}

/**
 * Clear metrics (useful for testing or resetting)
 */
export function clearMetrics(): void {
  performanceMetrics.length = 0;
}

export default performanceMonitor;
