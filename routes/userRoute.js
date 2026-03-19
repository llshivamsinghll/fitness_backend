import express from 'express';
import { signUp, login, getProfile, updateProfile, logout, validateToken } from '../controllers/userController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const user = express.Router();

// Public auth endpoints guarded by auth-specific throttling.
user.post('/signup', authLimiter, signUp);
user.post('/login', authLimiter, login);
user.post('/logout', logout);

// Session validation endpoint used by frontend rehydration.
user.get('/validate-token', authenticateToken, validateToken);

// Authenticated profile management endpoints.
user.get('/profile', authenticateToken, getProfile);
user.put('/profile', authenticateToken, updateProfile);

export default user;