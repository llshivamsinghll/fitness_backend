import express from 'express';
import { signUp, login, getProfile, updateProfile, logout, validateToken } from '../controllers/userController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const user = express.Router();

// Public routes with rate limiting
user.post('/signup', authLimiter, signUp);
user.post('/login', authLimiter, login);
user.post('/logout', logout);

// Token validation route
user.get('/validate-token', authenticateToken, validateToken);

// Protected routes (require authentication)
user.get('/profile', authenticateToken, getProfile);
user.put('/profile', authenticateToken, updateProfile);

export default user;