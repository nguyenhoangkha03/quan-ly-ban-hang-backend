import express, { Application } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

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

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      path: req.path,
      method: req.method,
    },
  });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.log('Error: ', err);

  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Something went wrong',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Sales & Production Management API                   ║
║                                                           ║
║   📡 Server running on: http://localhost:${PORT}          ║
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}                      ║
║   📚 API Docs: http://localhost:${PORT}/api-docs         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
