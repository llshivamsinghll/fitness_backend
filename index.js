import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';

import user from './routes/userRoute.js';
import imageRoutes from './routes/imageRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import { validateBackendEnvironment, getBackendEnvironmentInfo } from './utils/envValidation.js';
import { apiLimiter } from './middleware/rateLimiter.js';


const app = express();
const PORT = process.env.PORT || 10000;
console.log('Starting server...');
const envValidation = validateBackendEnvironment();
const envInfo = getBackendEnvironmentInfo();

console.log('Environment:', envInfo.nodeEnv);
console.log('Port:', envInfo.port);
console.log('Frontend URL:', envInfo.frontendUrl);

if (!envValidation.isValid) {
  // Stop startup when required environment variables are invalid.
  console.error('Environment validation failed:');
  envValidation.errors.forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}

if (envValidation.warnings.length > 0) {
  console.warn('Environment warnings:');
  envValidation.warnings.forEach(warning => console.warn(`  - ${warning}`));
}
// Build the explicit CORS allowlist from local dev origins plus configured frontend URL.
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL,
].filter(Boolean);

const isProduction = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: function (origin, callback) {
    // Allow server-to-server requests and health checks that do not send Origin.
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    if (isProduction && origin) {
      const trustedDomains = [
        'vercel.app',
        'netlify.app', 
        'render.com',
        'railway.app'
      ];

      // Permit trusted hosting domains to support preview URLs and platform subdomains.
      const isTrusted = trustedDomains.some(domain => origin.includes(domain));
      if (isTrusted) {
        return callback(null, true);
      }
    }
    console.warn('CORS: Blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));
app.use((req, res, next) => {
  // Apply baseline security headers to every response.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
  // Log request essentials for all environments and add deeper diagnostics in development.
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
if (process.env.NODE_ENV === 'production') {
  // Apply global API throttling only in production environments.
  app.use('/api/', apiLimiter);
  console.log('[INFO] Rate limiting enabled for production');
}
app.use('/api/user', user);
app.use('/api/images', imageRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/progress', progressRoutes);

// Simple health endpoint for uptime checks.
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    message: 'Server is running', 
    timestamp: new Date().toISOString(),
    services: ['user', 'images', 'ai', 'progress']
  });
});

// Root handlers for platform probes and basic uptime checks.
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Fitness backend is live' });
});

app.head('/', (req, res) => {
  res.sendStatus(200);
});

app.use((req, res, next) => {
  console.warn(`[404] ${req.method} ${req.path} not found`);
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});
app.use((err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  console.error('[ERROR] Error occurred:');
  console.error('  Message:', err.message);
  console.error('  Path:', req.path);
  console.error('  Method:', req.method);
  
  if (!isProduction) {
    console.error('  Stack:', err.stack);
  }
  const statusCode = err.status || err.statusCode || 500;

  // Return safe generic errors in production and richer diagnostics in development.
  res.status(statusCode).json({
    error: isProduction ? 'An error occurred' : err.message,
    message: err.message || 'Internal server error',
    ...((!isProduction) && { stack: err.stack, details: err })
  });
});
const server = app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Environment: ${envInfo.nodeEnv}`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(50));
});

// Graceful shutdown for orchestrator stop signals.
process.on('SIGTERM', () => {
  console.log('[INFO] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[INFO] Server closed');
    process.exit(0);
  });
});

// Graceful shutdown for local interruption (Ctrl+C).
process.on('SIGINT', () => {
  console.log('[INFO] SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('[INFO] Server closed');
    process.exit(0);
  });
});

// Crash fast on unhandled runtime failures to avoid unknown server state.
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  process.exit(1);
});

// Crash fast on unhandled promise rejections for the same reason.
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
