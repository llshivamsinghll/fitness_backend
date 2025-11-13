import express from 'express';
import {
  logWorkout,
  getWorkoutHistory,
  getWorkoutStats,
  logBodyMeasurement,
  getBodyMeasurements,
  getAchievements,
  getPersonalRecords,
  getProgressSummary
} from '../controllers/progressController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// All progress routes require authentication
router.use(authenticateToken);

// Workout logging
router.post('/workout', logWorkout);
router.get('/workout/history', getWorkoutHistory);
router.get('/workout/stats', getWorkoutStats);

// Body measurements
router.post('/measurement', logBodyMeasurement);
router.get('/measurement/history', getBodyMeasurements);

// Achievements and records
router.get('/achievements', getAchievements);
router.get('/records', getPersonalRecords);

// Summary
router.get('/summary', getProgressSummary);

export default router;
