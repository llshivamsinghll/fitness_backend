import express from 'express';
import {
  logWorkout,
  getWorkoutHistory,
  getWorkoutStats,
  logBodyMeasurement,
  getBodyMeasurements,
  getAchievements,
  getPersonalRecords,
  getProgressSummary,
  savePlanDayProgress,
  getPlanDayProgress
} from '../controllers/progressController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Progress data is private to a user account, so all endpoints require auth.
router.use(authenticateToken);

// Workout log and analytics endpoints.
router.post('/workout', logWorkout);
router.get('/workout/history', getWorkoutHistory);
router.get('/workout/stats', getWorkoutStats);

// Body measurement tracking endpoints.
router.post('/measurement', logBodyMeasurement);
router.get('/measurement/history', getBodyMeasurements);

// Achievement, PR, and summary endpoints for dashboard cards.
router.get('/achievements', getAchievements);
router.get('/records', getPersonalRecords);
router.get('/summary', getProgressSummary);

// Day-level plan progress used for autosave/resume on active plans.
router.get('/plan-day', getPlanDayProgress);
router.post('/plan-day', savePlanDayProgress);

export default router;
