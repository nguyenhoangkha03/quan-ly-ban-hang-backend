import compression from 'compression';
import { Request, Response } from 'express';

/**
 * Compression Middleware Configuration
 *
 * Compresses response bodies for all requests using gzip/deflate
 * Improves performance by reducing response size
 *
 * Features:
 * - Automatic compression for responses > 1KB
 * - Skip compression for already compressed content types
 * - Configurable compression level
 */

// Compression filter - determine if response should be compressed
const shouldCompress = (req: Request, res: Response): boolean => {
  // Don't compress if client explicitly says no
  if (req.headers['x-no-compression']) {
    return false;
  }

  // Use compression default filter
  return compression.filter(req, res);
};

// Export configured compression middleware
export const compressionMiddleware = compression({
  // Compression level: 0 (no compression) to 9 (maximum compression)
  // Level 6 is a good balance between speed and compression ratio
  level: 6,

  // Only compress responses larger than 1KB
  threshold: 1024,

  // Custom filter
  filter: shouldCompress,

  // Chunk size for compression (default 16KB)
  chunkSize: 16 * 1024,

  // Memory level: 1-9 (higher = more memory, better compression)
  memLevel: 8,

  // Strategy: Z_DEFAULT_STRATEGY, Z_FILTERED, Z_HUFFMAN_ONLY, Z_RLE, Z_FIXED
  strategy: 0, // Z_DEFAULT_STRATEGY
});

export default compressionMiddleware;
