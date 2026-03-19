import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Create a workout log entry and trigger PR/achievement recalculations.
export const logWorkout = async (req, res) => {
  try {
    const { exerciseName, sets, reps, weight, duration, notes, difficulty } = req.body;
    
    if (!exerciseName || !sets || !reps) {
      return res.status(400).json({ error: 'Exercise name, sets, and reps are required' });
    }

    const workoutLog = await prisma.workoutLog.create({
      data: {
        userId: req.user.id,
        exerciseName,
        sets: parseInt(sets),
        reps: parseInt(reps),
        weight: weight ? parseFloat(weight) : null,
        duration: duration ? parseInt(duration) : null,
        notes,
        difficulty
      }
    });
    await checkPersonalRecords(req.user.id, exerciseName, parseFloat(weight), parseInt(reps), parseInt(sets));
    await checkAchievements(req.user.id);
    
    res.status(201).json({
      success: true,
      message: 'Workout logged successfully',
      log: workoutLog
    });
  } catch (error) {
    console.error('[ERROR] Log workout error:', error);
    res.status(500).json({ 
      error: 'Failed to log workout',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Fetch workout history with optional date and exercise filters.
export const getWorkoutHistory = async (req, res) => {
  try {
    const { startDate, endDate, exerciseName, limit = 50 } = req.query;
    
    const where = {
      userId: req.user.id,
      ...(startDate && { completedAt: { gte: new Date(startDate) } }),
      ...(endDate && { completedAt: { lte: new Date(endDate) } }),
      ...(exerciseName && { exerciseName })
    };

    const logs = await prisma.workoutLog.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      take: parseInt(limit)
    });

    res.json({
      success: true,
      logs,
      count: logs.length
    });
  } catch (error) {
    console.error('[ERROR] Get workout history error:', error);
    res.status(500).json({ error: 'Failed to get workout history' });
  }
};

// Compute period-based workout stats and chart-ready daily counts.
export const getWorkoutStats = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const logs = await prisma.workoutLog.findMany({
      where: {
        userId: req.user.id,
        completedAt: { gte: startDate }
      }
    });
    const totalWorkouts = logs.length;
    const uniqueExercises = new Set(logs.map(log => log.exerciseName)).size;
    const totalSets = logs.reduce((sum, log) => sum + log.sets, 0);
    const totalReps = logs.reduce((sum, log) => sum + log.reps * log.sets, 0);
    // Total volume acts as a simple intensity indicator for dashboard trends.
    const totalVolume = logs.reduce((sum, log) => sum + (log.weight || 0) * log.reps * log.sets, 0);
    const workoutsByDate = {};
    logs.forEach(log => {
      const date = log.completedAt.toISOString().split('T')[0];
      workoutsByDate[date] = (workoutsByDate[date] || 0) + 1;
    });
    const streak = await calculateStreak(req.user.id);

    res.json({
      success: true,
      stats: {
        totalWorkouts,
        uniqueExercises,
        totalSets,
        totalReps,
        totalVolume: Math.round(totalVolume),
        streak,
        period: parseInt(period)
      },
      chartData: Object.entries(workoutsByDate).map(([date, count]) => ({
        date,
        workouts: count
      }))
    });
  } catch (error) {
    console.error('[ERROR] Get workout stats error:', error);
    res.status(500).json({ error: 'Failed to get workout statistics' });
  }
};

// Save a body-measurement snapshot for longitudinal tracking.
export const logBodyMeasurement = async (req, res) => {
  try {
    const { weight, bodyFat, muscleMass, chest, waist, hips, biceps, thighs, notes } = req.body;

    const measurement = await prisma.bodyMeasurement.create({
      data: {
        userId: req.user.id,
        weight: weight ? parseFloat(weight) : null,
        bodyFat: bodyFat ? parseFloat(bodyFat) : null,
        muscleMass: muscleMass ? parseFloat(muscleMass) : null,
        chest: chest ? parseFloat(chest) : null,
        waist: waist ? parseFloat(waist) : null,
        hips: hips ? parseFloat(hips) : null,
        biceps: biceps ? parseFloat(biceps) : null,
        thighs: thighs ? parseFloat(thighs) : null,
        notes
      }
    });

    res.status(201).json({
      success: true,
      message: 'Body measurement logged successfully',
      measurement
    });
  } catch (error) {
    console.error('[ERROR] Log body measurement error:', error);
    res.status(500).json({ 
      error: 'Failed to log body measurement',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Return measurement history plus deltas between oldest and latest entries.
export const getBodyMeasurements = async (req, res) => {
  try {
    const { startDate, endDate, limit = 50 } = req.query;
    
    const where = {
      userId: req.user.id,
      ...(startDate && { measuredAt: { gte: new Date(startDate) } }),
      ...(endDate && { measuredAt: { lte: new Date(endDate) } })
    };

    const measurements = await prisma.bodyMeasurement.findMany({
      where,
      orderBy: { measuredAt: 'desc' },
      take: parseInt(limit)
    });
    let progress = null;
    if (measurements.length >= 2) {
      const latest = measurements[0];
      const oldest = measurements[measurements.length - 1];
      
      progress = {
        weight: latest.weight && oldest.weight ? latest.weight - oldest.weight : null,
        bodyFat: latest.bodyFat && oldest.bodyFat ? latest.bodyFat - oldest.bodyFat : null,
        muscleMass: latest.muscleMass && oldest.muscleMass ? latest.muscleMass - oldest.muscleMass : null
      };
    }

    res.json({
      success: true,
      measurements,
      progress,
      count: measurements.length
    });
  } catch (error) {
    console.error('[ERROR] Get body measurements error:', error);
    res.status(500).json({ error: 'Failed to get body measurements' });
  }
};

// List all unlocked achievements for the current user.
export const getAchievements = async (req, res) => {
  try {
    const achievements = await prisma.achievement.findMany({
      where: { userId: req.user.id },
      orderBy: { unlockedAt: 'desc' }
    });

    res.json({
      success: true,
      achievements,
      count: achievements.length
    });
  } catch (error) {
    console.error('[ERROR] Get achievements error:', error);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
};

// List personal records, optionally narrowed to one exercise.
export const getPersonalRecords = async (req, res) => {
  try {
    const { exerciseName } = req.query;
    
    const where = {
      userId: req.user.id,
      ...(exerciseName && { exerciseName })
    };

    const records = await prisma.personalRecord.findMany({
      where,
      orderBy: { achievedAt: 'desc' }
    });

    res.json({
      success: true,
      records,
      count: records.length
    });
  } catch (error) {
    console.error('[ERROR] Get personal records error:', error);
    res.status(500).json({ error: 'Failed to get personal records' });
  }
};

// Build a dashboard summary with recent counts and latest key metrics.
export const getProgressSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [workouts, measurements, achievements, personalRecords] = await Promise.all([
      prisma.workoutLog.count({ where: { userId, completedAt: { gte: thirtyDaysAgo } } }),
      prisma.bodyMeasurement.count({ where: { userId, measuredAt: { gte: thirtyDaysAgo } } }),
      prisma.achievement.count({ where: { userId } }),
      prisma.personalRecord.count({ where: { userId } })
    ]);

    const streak = await calculateStreak(userId);
    const latestMeasurement = await prisma.bodyMeasurement.findFirst({
      where: { userId },
      orderBy: { measuredAt: 'desc' }
    });

    res.json({
      success: true,
      summary: {
        workoutsThisMonth: workouts,
        measurementsThisMonth: measurements,
        totalAchievements: achievements,
        totalPersonalRecords: personalRecords,
        currentStreak: streak,
        latestWeight: latestMeasurement?.weight || null,
        latestBodyFat: latestMeasurement?.bodyFat || null
      }
    });
  } catch (error) {
    console.error('[ERROR] Get progress summary error:', error);
    res.status(500).json({ error: 'Failed to get progress summary' });
  }
};

// Save day-level plan progress used by autosave and resume flows.
export const savePlanDayProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      planId,
      planDay,
      completedExercises = [],
      completedMeals = [],
      currentSet = {},
      workoutTimer = 0
    } = req.body;

    const parsedPlanId = Number(planId);
    const parsedPlanDay = Number(planDay);

    if (!Number.isInteger(parsedPlanId) || parsedPlanId <= 0) {
      return res.status(400).json({ error: 'Valid planId is required' });
    }

    if (!Number.isInteger(parsedPlanDay) || parsedPlanDay < 1 || parsedPlanDay > 7) {
      return res.status(400).json({ error: 'Valid planDay (1-7) is required' });
    }

    const plan = await prisma.plan.findFirst({
      where: { id: parsedPlanId, userId },
      select: { id: true }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found for user' });
    }

    const safeCompletedExercises = Array.isArray(completedExercises)
      ? completedExercises.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];

    const safeCompletedMeals = Array.isArray(completedMeals)
      ? completedMeals.map((index) => Number(index)).filter((index) => Number.isInteger(index) && index >= 0)
      : [];

    // Guard against malformed payloads by accepting object shape only.
    const safeCurrentSet = currentSet && typeof currentSet === 'object' ? currentSet : {};

    // Upsert keeps repeated autosave requests idempotent for the same user/plan/day key.
    const progress = await prisma.planDailyProgress.upsert({
      where: {
        userId_planId_planDay: {
          userId,
          planId: parsedPlanId,
          planDay: parsedPlanDay
        }
      },
      create: {
        userId,
        planId: parsedPlanId,
        planDay: parsedPlanDay,
        completedExercises: safeCompletedExercises,
        completedMeals: safeCompletedMeals,
        currentSet: safeCurrentSet,
        workoutTimer: Math.max(0, Number(workoutTimer) || 0)
      },
      update: {
        completedExercises: safeCompletedExercises,
        completedMeals: safeCompletedMeals,
        currentSet: safeCurrentSet,
        workoutTimer: Math.max(0, Number(workoutTimer) || 0)
      }
    });

    res.json({
      success: true,
      message: 'Plan day progress saved',
      progress
    });
  } catch (error) {
    console.error('[ERROR] Save plan day progress error:', error);
    res.status(500).json({ error: 'Failed to save plan day progress' });
  }
};

// Load previously saved day-level plan progress for the requested plan day.
export const getPlanDayProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const parsedPlanId = Number(req.query.planId);
    const parsedPlanDay = Number(req.query.planDay);

    if (!Number.isInteger(parsedPlanId) || parsedPlanId <= 0) {
      return res.status(400).json({ error: 'Valid planId is required' });
    }

    if (!Number.isInteger(parsedPlanDay) || parsedPlanDay < 1 || parsedPlanDay > 7) {
      return res.status(400).json({ error: 'Valid planDay (1-7) is required' });
    }

    const progress = await prisma.planDailyProgress.findUnique({
      where: {
        userId_planId_planDay: {
          userId,
          planId: parsedPlanId,
          planDay: parsedPlanDay
        }
      }
    });

    if (!progress) {
      return res.json({ success: true, progress: null });
    }

    res.json({ success: true, progress });
  } catch (error) {
    console.error('[ERROR] Get plan day progress error:', error);
    res.status(500).json({ error: 'Failed to get plan day progress' });
  }
};

// Compute current workout streak from unique workout calendar days.
async function calculateStreak(userId) {
  const logs = await prisma.workoutLog.findMany({
    where: { userId },
    orderBy: { completedAt: 'desc' },
    select: { completedAt: true }
  });

  if (logs.length === 0) return 0;

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const workoutDates = new Set(
    logs.map(log => {
      const date = new Date(log.completedAt);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    })
  );
  const today = currentDate.getTime();
  const yesterday = today - 86400000;
  
  if (!workoutDates.has(today) && !workoutDates.has(yesterday)) {
    return 0;
  }

  // A streak is considered active only when today's or yesterday's workout exists.
  let checkDate = workoutDates.has(today) ? today : yesterday;
  while (workoutDates.has(checkDate)) {
    streak++;
    checkDate -= 86400000;
  }

  return streak;
}

// Update PR entries for max weight and total volume after a workout is logged.
async function checkPersonalRecords(userId, exerciseName, weight, reps, sets) {
  if (!weight || weight <= 0) return;

  try {
    const totalVolume = weight * reps * sets;
    const maxWeightRecord = await prisma.personalRecord.findUnique({
      where: {
        userId_exerciseName_recordType: {
          userId,
          exerciseName,
          recordType: 'MAX_WEIGHT'
        }
      }
    });

    if (!maxWeightRecord || weight > maxWeightRecord.value) {
      await prisma.personalRecord.upsert({
        where: {
          userId_exerciseName_recordType: {
            userId,
            exerciseName,
            recordType: 'MAX_WEIGHT'
          }
        },
        create: {
          userId,
          exerciseName,
          recordType: 'MAX_WEIGHT',
          value: weight,
          unit: 'kg'
        },
        update: {
          value: weight,
          achievedAt: new Date()
        }
      });
    }
    const volumeRecord = await prisma.personalRecord.findUnique({
      where: {
        userId_exerciseName_recordType: {
          userId,
          exerciseName,
          recordType: 'TOTAL_VOLUME'
        }
      }
    });

    if (!volumeRecord || totalVolume > volumeRecord.value) {
      await prisma.personalRecord.upsert({
        where: {
          userId_exerciseName_recordType: {
            userId,
            exerciseName,
            recordType: 'TOTAL_VOLUME'
          }
        },
        create: {
          userId,
          exerciseName,
          recordType: 'TOTAL_VOLUME',
          value: totalVolume,
          unit: 'kg'
        },
        update: {
          value: totalVolume,
          achievedAt: new Date()
        }
      });
    }
  } catch (error) {
    console.error('[ERROR] Check personal records error:', error);
  }
}

// Unlock achievement milestones for streak days and total workout count.
async function checkAchievements(userId) {
  try {
    const streak = await calculateStreak(userId);
    const streakMilestones = [
      { days: 7, title: 'Week Warrior', description: 'Completed 7 consecutive days of workouts' },
      { days: 14, title: 'Two Week Champion', description: '14 days workout streak' },
      { days: 30, title: 'Monthly Master', description: '30 days workout streak' },
      { days: 60, title: 'Consistency King', description: '60 days workout streak' },
      { days: 100, title: 'Century Club', description: '100 days workout streak' }
    ];

    for (const milestone of streakMilestones) {
      if (streak >= milestone.days) {
        const existing = await prisma.achievement.findFirst({
          where: {
            userId,
            type: 'WORKOUT_STREAK',
            title: milestone.title
          }
        });

        if (!existing) {
          await prisma.achievement.create({
            data: {
              userId,
              type: 'WORKOUT_STREAK',
              title: milestone.title,
              description: milestone.description,
              icon: 'trophy'
            }
          });
        }
      }
    }
    const totalWorkouts = await prisma.workoutLog.count({ where: { userId } });
    const workoutMilestones = [
      { count: 10, title: 'Getting Started', description: 'Completed 10 workouts' },
      { count: 50, title: 'Half Century', description: 'Completed 50 workouts' },
      { count: 100, title: 'Centurion', description: 'Completed 100 workouts' },
      { count: 250, title: 'Quarter Champion', description: 'Completed 250 workouts' },
      { count: 500, title: 'Legendary', description: 'Completed 500 workouts' }
    ];

    for (const milestone of workoutMilestones) {
      if (totalWorkouts >= milestone.count) {
        const existing = await prisma.achievement.findFirst({
          where: {
            userId,
            type: 'WORKOUT_COUNT',
            title: milestone.title
          }
        });

        if (!existing) {
          await prisma.achievement.create({
            data: {
              userId,
              type: 'WORKOUT_COUNT',
              title: milestone.title,
              description: milestone.description,
              icon: 'medal'
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('[ERROR] Check achievements error:', error);
  }
}
