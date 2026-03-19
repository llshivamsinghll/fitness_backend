import express from 'express';
import aiController from '../controllers/aiController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
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
router.use(authenticateToken);
router.post('/workout-recommendations', aiLimiter, aiController.getWorkoutRecommendations);
router.post('/meal-plan', aiLimiter, aiController.getMealPlanRecommendations);
router.post('/coach-advice', aiLimiter, aiController.getFitnessCoachAdvice);
router.post('/analyze-progress', aiLimiter, aiController.analyzeProgress);
router.post('/exercise-form', aiLimiter, aiController.analyzeExerciseForm);
router.get('/quick-tips', aiController.getQuickTips);
router.post('/exercise-alternatives', aiLimiter, aiController.getExerciseAlternatives);
router.post('/generate-and-save', aiLimiter, aiController.generateAndSavePlan);
router.get('/latest-plan', aiController.getLatestPlan);

export default router;