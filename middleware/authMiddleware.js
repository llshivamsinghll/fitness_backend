import jwt from 'jsonwebtoken';
import { PrismaClient } from '../generated/prisma/index.js';

const prisma = new PrismaClient();

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('AuthMiddleware: Authorization header:', authHeader ? 'Present' : 'Missing');
    console.log('AuthMiddleware: Token extracted:', token ? 'Yes' : 'No');

    if (!token) {
      console.log('AuthMiddleware: No token provided');
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('AuthMiddleware: Token decoded, userId:', decoded.userId);
    
    // Get user details from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true } // Exclude password
    });

    console.log('AuthMiddleware: User found in DB:', !!user);
    if (!user) {
      console.log('AuthMiddleware: User not found for userId:', decoded.userId);
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }

    req.user = user; // Attach user to request
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

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
    // For optional auth, we continue even if token is invalid
    next();
  }
};
