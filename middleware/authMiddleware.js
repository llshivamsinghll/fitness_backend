import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Enforce authenticated access by verifying JWT and resolving the active user.
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      console.log('[AUTH] AuthMiddleware:', {
        hasAuthHeader: !!authHeader,
        hasToken: !!token,
        path: req.path
      });
    }

    if (!token) {
      console.log('[AUTH] AuthMiddleware: No token provided for path:', req.path);
      return res.status(401).json({ 
        error: 'Access token required',
        message: 'Please login to access this resource'
      });
    }

    // Verify token signature/expiry before querying database.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded || !decoded.userId) {
      console.log('[AUTH] AuthMiddleware: Invalid token structure');
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    if (isDev) {
      console.log('[AUTH] AuthMiddleware: Token verified for userId:', decoded.userId);
    }
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      console.log('[AUTH] AuthMiddleware: User not found in DB for userId:', decoded.userId);
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'User no longer exists'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[ERROR] AuthMiddleware error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Your session has expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Authentication token is invalid',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'NotBeforeError') {
      return res.status(401).json({ 
        error: 'Token not active',
        message: 'Token is not yet active',
        code: 'TOKEN_NOT_ACTIVE'
      });
    }
    
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: 'An error occurred during authentication',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Optionally attaches user context when token exists; never blocks anonymous requests.
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, email: true }
      });
      req.user = user;
    }
    
    next();
  } catch (error) {
    next();
  }
};
