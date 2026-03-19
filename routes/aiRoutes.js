import express from 'express';
import aiController from '../controllers/aiController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public health probe for monitoring and deploy readiness checks.
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

// All AI routes below require an authenticated user context.
router.use(authenticateToken);

// Higher-cost AI generation endpoints use stricter throttling.
router.post('/workout-recommendations', aiLimiter, aiController.getWorkoutRecommendations);
router.post('/meal-plan', aiLimiter, aiController.getMealPlanRecommendations);
router.post('/coach-advice', aiLimiter, aiController.getFitnessCoachAdvice);
router.post('/analyze-progress', aiLimiter, aiController.analyzeProgress);
router.post('/exercise-form', aiLimiter, aiController.analyzeExerciseForm);

// Quick tips is intentionally lightweight and not rate-limited by aiLimiter.
router.get('/quick-tips', aiController.getQuickTips);
router.post('/exercise-alternatives', aiLimiter, aiController.getExerciseAlternatives);
router.post('/generate-and-save', aiLimiter, aiController.generateAndSavePlan);
router.get('/latest-plan', aiController.getLatestPlan);

export default router;