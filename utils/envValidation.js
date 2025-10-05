// Backend Environment Variables Validation
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const validateBackendEnvironment = () => {
  const errors = [];
  const warnings = [];

  // Required environment variables
  const required = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
  };

  // Optional but recommended
  const optional = {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    FRONTEND_URL: process.env.FRONTEND_URL,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };

  // Check required variables
  Object.entries(required).forEach(([key, value]) => {
    if (!value) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  });

  // Check optional variables
  Object.entries(optional).forEach(([key, value]) => {
    if (!value) {
      warnings.push(`Missing optional environment variable: ${key} (using default)`);
    }
  });

  // Validate specific formats
  if (required.DATABASE_URL && !required.DATABASE_URL.startsWith('postgresql://')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
  }

  if (optional.FRONTEND_URL && !optional.FRONTEND_URL.startsWith('http')) {
    warnings.push('FRONTEND_URL should start with http:// or https://');
  }

  // Security checks
  if (required.JWT_SECRET && required.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters long for security');
  }

  if (required.JWT_SECRET && required.JWT_SECRET === 'your-super-secret-jwt-key-here-make-it-long-and-random') {
    errors.push('JWT_SECRET is still using default value - please change it for security');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    config: {
      ...required,
      ...optional,
      // Mask sensitive data in logs
      JWT_SECRET: required.JWT_SECRET ? '***masked***' : undefined,
      GROQ_API_KEY: required.GROQ_API_KEY ? '***masked***' : undefined,
      CLOUDINARY_API_SECRET: optional.CLOUDINARY_API_SECRET ? '***masked***' : undefined,
    }
  };
};

// Get environment info for logging
export const getBackendEnvironmentInfo = () => {
  const validation = validateBackendEnvironment();
  
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    hasDatabase: !!process.env.DATABASE_URL,
    hasGroqApi: !!process.env.GROQ_API_KEY,
    hasCloudinary: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY),
    validation: {
      isValid: validation.isValid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length
    },
    timestamp: new Date().toISOString()
  };
};