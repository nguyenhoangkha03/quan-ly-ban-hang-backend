import express, { Application } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler, notFoundHandler } from '@middlewares/errorHandler';
import { globalRateLimiter } from '@middlewares/rateLimiter';
import { sanitizeInput } from '@middlewares/validate';
import RedisService from '@services/redis.service';

// Import routes
import authRoutes from '@routes/auth.routes';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Initialize Redis
const initializeRedis = async () => {
  try {
    const redis = RedisService.getInstance();
    await redis.initialize();
    console.log('✅ Redis connected successfully');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    console.log('⚠️  Server will continue without Redis (cache disabled)');
  }
};

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Security middleware
app.use(globalRateLimiter); // Rate limiting
app.use(sanitizeInput); // XSS protection

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    enviroment: process.env.NODE_ENV || 'development',
  });
});

app.get('/api', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Quản Lý Bán Hàng API',
    version: '1.0.0',
    documentation: '/api-docs',
  });
});

// API Routes
app.use('/api/auth', authRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, async () => {
  // Initialize Redis connection
  await initializeRedis();

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Sales & Production Management API                   ║
║                                                           ║
║   📡 Server running on: http://localhost:${PORT}          ║
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}                      ║
║   📚 API Docs: http://localhost:${PORT}/api-docs         ║
║   🔐 Auth API: http://localhost:${PORT}/api/auth         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
