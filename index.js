import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import user from './routes/userRoute.js';
import imageRoutes from './routes/imageRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { validateBackendEnvironment, getBackendEnvironmentInfo } from './utils/envValidation.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Environment validation
console.log('🚀 Starting server...');
const envValidation = validateBackendEnvironment();
const envInfo = getBackendEnvironmentInfo();

console.log('📍 Environment:', envInfo.nodeEnv);
console.log('🔌 Port:', envInfo.port);
console.log('🌐 Frontend URL:', envInfo.frontendUrl);

if (!envValidation.isValid) {
  console.error('❌ Environment validation failed:');
  envValidation.errors.forEach(error => console.error(`   • ${error}`));
  process.exit(1);
}

if (envValidation.warnings.length > 0) {
  console.warn('⚠️  Environment warnings:');
  envValidation.warnings.forEach(warning => console.warn(`   • ${warning}`));
}

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/user', user);
app.use('/api/images', imageRoutes);
app.use('/api/ai', aiRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    message: 'Server is running', 
    timestamp: new Date().toISOString(),
    services: ['user', 'images', 'ai']
  });
});

// 404 handler - using middleware instead of route
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});



app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);

  // console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});