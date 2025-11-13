import express from 'express';
import aiController from '../controllers/aiController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

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

// Workout Recommendations (with AI rate limiting)
router.post('/workout-recommendations', aiLimiter, aiController.getWorkoutRecommendations);

// Meal Plan Recommendations (with AI rate limiting)
router.post('/meal-plan', aiLimiter, aiController.getMealPlanRecommendations);

// AI Fitness Coach Chat (with AI rate limiting)
router.post('/coach-advice', aiLimiter, aiController.getFitnessCoachAdvice);

// Progress Analysis (with AI rate limiting)
router.post('/analyze-progress', aiLimiter, aiController.analyzeProgress);

// Exercise Form Analysis (with AI rate limiting)
router.post('/exercise-form', aiLimiter, aiController.analyzeExerciseForm);

// Quick Fitness Tips (no rate limit - cached/lightweight)
router.get('/quick-tips', aiController.getQuickTips);

// Exercise Alternatives (with AI rate limiting)
router.post('/exercise-alternatives', aiLimiter, aiController.getExerciseAlternatives);

// Generate both plans and save (with AI rate limiting)
router.post('/generate-and-save', aiLimiter, aiController.generateAndSavePlan);

// Get latest saved plan
router.get('/latest-plan', aiController.getLatestPlan);

export default router;