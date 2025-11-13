import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Log a workout
export const logWorkout = async (req, res) => {
  try {
    const { exerciseName, sets, reps, weight, duration, notes, difficulty } = req.body;
    
    console.log('[PROGRESS] Logging workout for user:', req.user.email);
    
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

    // Check for personal records
    await checkPersonalRecords(req.user.id, exerciseName, parseFloat(weight), parseInt(reps), parseInt(sets));

    // Check for achievements
    await checkAchievements(req.user.id);

    console.log('[PROGRESS] Workout logged successfully');
    
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

// Get workout history
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

// Get workout statistics
export const getWorkoutStats = async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const logs = await prisma.workoutLog.findMany({
      where: {
        userId: req.user.id,
        completedAt: { gte: startDate }
      }
    });

    // Calculate statistics
    const totalWorkouts = logs.length;
    const uniqueExercises = new Set(logs.map(log => log.exerciseName)).size;
    const totalSets = logs.reduce((sum, log) => sum + log.sets, 0);
    const totalReps = logs.reduce((sum, log) => sum + log.reps * log.sets, 0);
    const totalVolume = logs.reduce((sum, log) => sum + (log.weight || 0) * log.reps * log.sets, 0);
    
    // Group by date for chart data
    const workoutsByDate = {};
    logs.forEach(log => {
      const date = log.completedAt.toISOString().split('T')[0];
      workoutsByDate[date] = (workoutsByDate[date] || 0) + 1;
    });

    // Calculate streak
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

// Log body measurement
export const logBodyMeasurement = async (req, res) => {
  try {
    const { weight, bodyFat, muscleMass, chest, waist, hips, biceps, thighs, notes } = req.body;
    
    console.log('[PROGRESS] Logging body measurement for user:', req.user.email);

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

    console.log('[PROGRESS] Body measurement logged successfully');

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

// Get body measurement history
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

    // Calculate progress
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

// Get achievements
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

// Get personal records
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

// Get progress summary
export const getProgressSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get recent stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [workouts, measurements, achievements, personalRecords] = await Promise.all([
      prisma.workoutLog.count({ where: { userId, completedAt: { gte: thirtyDaysAgo } } }),
      prisma.bodyMeasurement.count({ where: { userId, measuredAt: { gte: thirtyDaysAgo } } }),
      prisma.achievement.count({ where: { userId } }),
      prisma.personalRecord.count({ where: { userId } })
    ]);

    const streak = await calculateStreak(userId);

    // Get latest body measurement
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

// Helper: Calculate workout streak
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

  // Check if there's a workout today or yesterday
  const today = currentDate.getTime();
  const yesterday = today - 86400000;
  
  if (!workoutDates.has(today) && !workoutDates.has(yesterday)) {
    return 0;
  }

  // Count consecutive days
  let checkDate = workoutDates.has(today) ? today : yesterday;
  while (workoutDates.has(checkDate)) {
    streak++;
    checkDate -= 86400000; // Go back one day
  }

  return streak;
}

// Helper: Check for personal records
async function checkPersonalRecords(userId, exerciseName, weight, reps, sets) {
  if (!weight || weight <= 0) return;

  try {
    const totalVolume = weight * reps * sets;

    // Check max weight
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

      console.log(`[ACHIEVEMENT] New max weight PR for ${exerciseName}: ${weight}kg`);
    }

    // Check total volume
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

      console.log(`[ACHIEVEMENT] New volume PR for ${exerciseName}: ${totalVolume}kg`);
    }
  } catch (error) {
    console.error('[ERROR] Check personal records error:', error);
  }
}

// Helper: Check for achievements
async function checkAchievements(userId) {
  try {
    const streak = await calculateStreak(userId);
    
    // Streak achievements
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
          console.log(`[ACHIEVEMENT] Unlocked: ${milestone.title}`);
        }
      }
    }

    // Workout count achievements
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
          console.log(`[ACHIEVEMENT] Unlocked: ${milestone.title}`);
        }
      }
    }
  } catch (error) {
    console.error('[ERROR] Check achievements error:', error);
  }
}
