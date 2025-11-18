import { PrismaClient } from '@prisma/client';
import logger from '@utils/logger';

/**
 * Prisma Client Configuration with Performance Optimization
 *
 * Features:
 * - Connection pooling
 * - Query logging (slow queries)
 * - Error handling
 * - Singleton pattern
 */

// Configuration
const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10); // 1 second
const LOG_QUERIES = process.env.LOG_QUERIES === 'true';
const LOG_SLOW_QUERIES = process.env.LOG_SLOW_QUERIES !== 'false'; // Enabled by default

// Determine log level based on environment
const logLevel: ('query' | 'info' | 'warn' | 'error')[] =
  process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['warn', 'error'];

// Create Prisma Client with configuration
const prisma = new PrismaClient({
  log: LOG_QUERIES ? logLevel : ['warn', 'error'],
  errorFormat: 'pretty',

  // Connection pooling configuration
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// =====================================================
// QUERY LOGGING & MONITORING
// =====================================================

if (LOG_QUERIES || LOG_SLOW_QUERIES) {
  // Log all queries (if enabled)
  prisma.$on('query', (e: any) => {
    if (LOG_QUERIES) {
      logger.debug('Prisma Query', {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
        target: e.target,
      });
    }

    // Log slow queries
    if (LOG_SLOW_QUERIES && e.duration > SLOW_QUERY_THRESHOLD) {
      logger.warn('Slow Prisma Query Detected', {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
        threshold: `${SLOW_QUERY_THRESHOLD}ms`,
        target: e.target,
      });
    }
  });
}

// Log Prisma info events
prisma.$on('info', (e: any) => {
  logger.info('Prisma Info', {
    message: e.message,
    timestamp: e.timestamp,
  });
});

// Log Prisma warnings
prisma.$on('warn', (e: any) => {
  logger.warn('Prisma Warning', {
    message: e.message,
    timestamp: e.timestamp,
  });
});

// Log Prisma errors
prisma.$on('error', (e: any) => {
  logger.error('Prisma Error', {
    message: e.message,
    timestamp: e.timestamp,
  });
});

// =====================================================
// CONNECTION MANAGEMENT
// =====================================================

/**
 * Connect to database
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Database disconnection error:', error);
  }
}

/**
 * Health check - test database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Get database metrics
 */
export async function getDatabaseMetrics(): Promise<{
  connected: boolean;
  pool?: any;
}> {
  try {
    const isConnected = await checkDatabaseHealth();

    return {
      connected: isConnected,
      // Note: Prisma doesn't expose connection pool metrics directly
      // For detailed pool metrics, you'd need to query the database directly
    };
  } catch (error) {
    return {
      connected: false,
    };
  }
}

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await disconnectDatabase();
});

process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDatabase();
  process.exit(0);
});

// =====================================================
// EXPORT
// =====================================================

export default prisma;
export { prisma };
