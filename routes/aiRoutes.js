import express from 'express';
import aiController from '../controllers/aiController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Rate limiting middleware for AI endpoints (optional but recommended)
const aiRateLimit = (req, res, next) => {
  // Add rate limiting logic here if needed
  next();
};

// Health check endpoint for AI service (no auth required)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'AI service is running',
    timestamp: new Date().toISOString(),
    features: [
      'workout-recommendations',
      'meal-plan',
      'coach-advice',
      'analyze-progress',
      'exercise-form',
      'quick-tips',
      'exercise-alternatives'
    ]
  });
});

// Apply authentication middleware to all protected AI routes
router.use(authenticateToken);

// Workout Recommendations
router.post('/workout-recommendations', aiRateLimit, aiController.getWorkoutRecommendations);

// Meal Plan Recommendations  
router.post('/meal-plan', aiRateLimit, aiController.getMealPlanRecommendations);

// AI Fitness Coach Chat
router.post('/coach-advice', aiRateLimit, aiController.getFitnessCoachAdvice);

// Progress Analysis
router.post('/analyze-progress', aiRateLimit, aiController.analyzeProgress);

// Exercise Form Analysis
router.post('/exercise-form', aiRateLimit, aiController.analyzeExerciseForm);

// Quick Fitness Tips
router.get('/quick-tips', aiController.getQuickTips);

// Exercise Alternatives
router.post('/exercise-alternatives', aiRateLimit, aiController.getExerciseAlternatives);

export default router;