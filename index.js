import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import user from './routes/userRoute.js';
import imageRoutes from './routes/imageRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import { validateBackendEnvironment, getBackendEnvironmentInfo } from './utils/envValidation.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Environment validation
console.log('Starting server...');
const envValidation = validateBackendEnvironment();
const envInfo = getBackendEnvironmentInfo();

console.log('Environment:', envInfo.nodeEnv);
console.log('Port:', envInfo.port);
console.log('Frontend URL:', envInfo.frontendUrl);

if (!envValidation.isValid) {
  console.error('Environment validation failed:');
  envValidation.errors.forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}

if (envValidation.warnings.length > 0) {
  console.warn('Environment warnings:');
  envValidation.warnings.forEach(warning => console.warn(`  - ${warning}`));
}

// CORS configuration - Production ready
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL,
].filter(Boolean); // Remove undefined values

const isProduction = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.) only in development
    if (!origin && !isProduction) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    // In production, also allow trusted domains
    if (isProduction && origin) {
      const trustedDomains = [
        'vercel.app',
        'netlify.app', 
        'render.com',
        'railway.app'
      ];
      
      const isTrusted = trustedDomains.some(domain => origin.includes(domain));
      if (isTrusted) {
        return callback(null, true);
      }
    }
    
    // In development, allow all origins
    if (!isProduction) {
      console.warn('CORS: Allowing origin (dev mode):', origin);
      return callback(null, true);
    }
    
    // In production, reject unknown origins
    console.warn('CORS: Blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours - cache preflight requests
}));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const origin = req.headers.origin || 'no-origin';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  console.log(`  Origin: ${origin}`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`  User-Agent: ${userAgent}`);
    console.log(`  Body:`, req.body ? JSON.stringify(req.body).substring(0, 100) : 'empty');
  }
  
  next();
});

// Apply rate limiting to all API routes (can be customized per route)
if (process.env.NODE_ENV === 'production') {
  app.use('/api/', apiLimiter);
  console.log('[INFO] Rate limiting enabled for production');
}

// Routes
app.use('/api/user', user);
app.use('/api/images', imageRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/progress', progressRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    message: 'Server is running', 
    timestamp: new Date().toISOString(),
    services: ['user', 'images', 'ai', 'progress']
  });
});

// 404 handler - using middleware instead of route
app.use((req, res, next) => {
  console.warn(`[404] ${req.method} ${req.path} not found`);
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Log error details
  console.error('[ERROR] Error occurred:');
  console.error('  Message:', err.message);
  console.error('  Path:', req.path);
  console.error('  Method:', req.method);
  
  if (!isProduction) {
    console.error('  Stack:', err.stack);
  }
  
  // Send appropriate response
  const statusCode = err.status || err.statusCode || 500;
  
  res.status(statusCode).json({
    error: isProduction ? 'An error occurred' : err.message,
    message: err.message || 'Internal server error',
    ...((!isProduction) && { stack: err.stack, details: err })
  });
});

// Graceful shutdown handling
const server = app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Environment: ${envInfo.nodeEnv}`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(50));
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[INFO] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[INFO] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[INFO] SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('[INFO] Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});