import express, { Application } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { errorHandler, notFoundHandler } from '@middlewares/errorHandler';
import { globalRateLimiter } from '@middlewares/rateLimiter';
import { sanitizeInput } from '@middlewares/validate';
import RedisService from '@services/redis.service';
import uploadService from '@services/upload.service';

// Import routes
import authRoutes from '@routes/auth.routes';
import userRoutes from '@routes/user.routes';
import roleRoutes from '@routes/role.routes';
import permissionRoutes from '@routes/permission.routes';
import warehouseRoutes from '@routes/warehouse.routes';
import categoryRoutes from '@routes/category.routes';
import supplierRoutes from '@routes/supplier.routes';
import productRoutes from '@routes/product.routes';
import inventoryRoutes from '@routes/inventory.routes';
import stockTransactionRoutes from '@routes/stock-transaction.routes';
import stockTransferRoutes from '@routes/stock-transfer.routes';
import bomRoutes from '@routes/bom.routes';
import productionOrderRoutes from '@routes/production-order.routes';
import customerRoutes from '@routes/customer.routes';

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

// Initialize upload directories
const initializeUploads = async () => {
  try {
    await uploadService.ensureUploadDirs();
    console.log('✅ Upload directories initialized');
  } catch (error) {
    console.error('❌ Failed to initialize upload directories:', error);
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

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stock-transactions', stockTransactionRoutes);
app.use('/api/stock-transfers', stockTransferRoutes);
app.use('/api/bom', bomRoutes);
app.use('/api/production-orders', productionOrderRoutes);
app.use('/api/customers', customerRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, async () => {
  // Initialize Redis connection
  await initializeRedis();

  // Initialize upload directories
  await initializeUploads();

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Sales & Production Management API                   ║
║                                                           ║
║   📡 Server running on: http://localhost:${PORT}          ║
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}                      ║
║   📚 API Docs: http://localhost:${PORT}/api-docs         ║
║   🔐 Auth API: http://localhost:${PORT}/api/auth         ║
║   👥 User API: http://localhost:${PORT}/api/users        ║
║   🔑 Role API: http://localhost:${PORT}/api/roles        ║
║   ⚙️  Permission API: http://localhost:${PORT}/api/permissions ║
║   🏢 Warehouse API: http://localhost:${PORT}/api/warehouses ║
║   📂 Category API: http://localhost:${PORT}/api/categories ║
║   🏭 Supplier API: http://localhost:${PORT}/api/suppliers ║
║   📦 Product API: http://localhost:${PORT}/api/products   ║
║   📊 Inventory API: http://localhost:${PORT}/api/inventory ║
║   🔄 Stock Transaction API: http://localhost:${PORT}/api/stock-transactions ║
║   🚚 Stock Transfer API: http://localhost:${PORT}/api/stock-transfers ║
║   📋 BOM API: http://localhost:${PORT}/api/bom           ║
║   🏭 Production Orders API: http://localhost:${PORT}/api/production-orders ║
║   👤 Customer API: http://localhost:${PORT}/api/customers ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
