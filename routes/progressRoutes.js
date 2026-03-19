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
router.use(authenticateToken);
router.post('/workout', logWorkout);
router.get('/workout/history', getWorkoutHistory);
router.get('/workout/stats', getWorkoutStats);
router.post('/measurement', logBodyMeasurement);
router.get('/measurement/history', getBodyMeasurements);
router.get('/achievements', getAchievements);
router.get('/records', getPersonalRecords);
router.get('/summary', getProgressSummary);
router.get('/plan-day', getPlanDayProgress);
router.post('/plan-day', savePlanDayProgress);

export default router;
