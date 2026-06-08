import dotenv from 'dotenv';
dotenv.config();

export const validateBackendEnvironment = () => {
  const errors = [];
  const warnings = [];
  const required = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
  };
  const optional = {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    FRONTEND_URL: process.env.FRONTEND_URL,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };
  Object.entries(required).forEach(([key, value]) => {
    if (!value) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  });
  Object.entries(optional).forEach(([key, value]) => {
    if (!value) {
      warnings.push(`Missing optional environment variable: ${key} (using default)`);
    }
  });
  if (required.DATABASE_URL && !required.DATABASE_URL.startsWith('postgresql://')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
  }

  if (optional.FRONTEND_URL && !optional.FRONTEND_URL.startsWith('http')) {
    warnings.push('FRONTEND_URL should start with http:// or https://');
  }
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
      JWT_SECRET: required.JWT_SECRET ? '***masked***' : undefined,
      GROQ_API_KEY: required.GROQ_API_KEY ? '***masked***' : undefined,
      CLOUDINARY_API_SECRET: optional.CLOUDINARY_API_SECRET ? '***masked***' : undefined,
    }
  };
};
export const getBackendEnvironmentInfo = () => {
  const validation = validateBackendEnvironment();
  
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 10000,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',
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
