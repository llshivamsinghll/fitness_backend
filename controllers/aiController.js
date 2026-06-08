import aiService from '../utils/aiService.js';
import { PrismaClient } from '@prisma/client';
import { PLAN_SCHEMA_VERSION } from '../utils/planSchema.js';

const prisma = new PrismaClient();

function buildCompleteProfile(dbProfile, body = {}) {
  return {
    age: parseInt(dbProfile?.age || body.age),
    weight: parseFloat(dbProfile?.weight || body.weight),
    height: parseFloat(dbProfile?.height || body.height),
    gender: dbProfile?.gender || body.gender || 'not-specified',
    fitnessGoal: dbProfile?.fitnessGoal || body.fitnessGoal,
    activityLevel: dbProfile?.activityLevel || body.activityLevel || 'moderate',
    dietPreference: dbProfile?.dietPreference || body.dietPreference || 'none',
    duration: parseInt(dbProfile?.planDuration || body.planDuration || body.duration) || 8,
    name: dbProfile?.name || body.name || 'User',
    workoutPreference: body.workoutPreference || 'mixed',
    injuries: Array.isArray(body.injuries) ? body.injuries : [],
    medicalConditions: dbProfile?.medicalConditions || body.medicalConditions || 'none',
    location: dbProfile?.location || body.location || null,
    state: dbProfile?.state || body.state || null,
    cuisine: dbProfile?.cuisine || body.cuisine || null
  };
}

function validateProfileForPlan(profile) {
  const missing = [];
  if (!Number.isFinite(profile.age)) missing.push('age');
  if (!Number.isFinite(profile.weight)) missing.push('weight');
  if (!Number.isFinite(profile.height)) missing.push('height');
  if (!profile.fitnessGoal) missing.push('fitnessGoal');
  if (!profile.activityLevel) missing.push('activityLevel');
  return missing;
}

// Generate workout guidance using persisted profile values with request-body fallback.
export const getWorkoutRecommendations = async (req, res) => {
  try {
    const dbProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id }
    });
    const userProfile = buildCompleteProfile(dbProfile, req.body);
    const missing = validateProfileForPlan(userProfile);

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required profile fields: ${missing.join(', ')}`
      });
    }
    
    const recommendations = await aiService.getWorkoutRecommendations(userProfile);
    
    res.json({
      success: true,
      data: recommendations,
      message: 'Workout recommendations generated successfully'
    });
    
  } catch (error) {
    console.error('Error generating workout recommendations:', error);
    res.status(500).json({ 
      error: 'Failed to generate workout recommendations',
      details: error.message 
    });
  }
};

// Generate meal plan guidance with the same profile merge strategy as workouts.
export const getMealPlanRecommendations = async (req, res) => {
  try {
    const dbProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id }
    });
    const userProfile = buildCompleteProfile(dbProfile, req.body);
    const missing = validateProfileForPlan(userProfile);

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required profile fields: ${missing.join(', ')}`
      });
    }
    
    const mealPlan = await aiService.getMealPlanRecommendations(userProfile);
    
    res.json({
      success: true,
      data: mealPlan,
      message: 'Meal plan generated successfully'
    });
    
  } catch (error) {
    console.error('Error generating meal plan:', error);
    res.status(500).json({ 
      error: 'Failed to generate meal plan',
      details: error.message 
    });
  }
};

// Return AI coach advice after validating prompt presence and length limits.
export const getFitnessCoachAdvice = async (req, res) => {
  try {
    const { question, userContext } = req.body;
    
    if (!question || question.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Question is required' 
      });
    }
    if (question.length > 500) {
      return res.status(400).json({ 
        error: 'Question too long. Please keep it under 500 characters.' 
      });
    }
    
    const advice = await aiService.getFitnessCoachAdvice(question, userContext || {});
    
    res.json({
      success: true,
      data: {
        question,
        advice,
        timestamp: new Date().toISOString()
      },
      message: 'Fitness advice provided successfully'
    });
    
  } catch (error) {
    console.error('Error getting fitness advice:', error);
    res.status(500).json({ 
      error: 'Failed to get fitness advice',
      details: error.message 
    });
  }
};

// Ask AI to analyze progress input; reject empty metric payloads.
export const analyzeProgress = async (req, res) => {
  try {
    const { workoutHistory, weightHistory, goalProgress, timeframe } = req.body;
    
    if (!workoutHistory && !weightHistory && !goalProgress) {
      return res.status(400).json({ 
        error: 'At least one progress metric is required (workoutHistory, weightHistory, or goalProgress)' 
      });
    }
    
    const progressData = {
      workoutHistory: workoutHistory || [],
      weightHistory: weightHistory || [],
      goalProgress: goalProgress || {},
      timeframe: timeframe || '30 days'
    };
    
    const analysis = await aiService.analyzeProgress(progressData);
    
    res.json({
      success: true,
      data: analysis,
      message: 'Progress analysis completed successfully'
    });
    
  } catch (error) {
    console.error('Error analyzing progress:', error);
    res.status(500).json({ 
      error: 'Failed to analyze progress',
      details: error.message 
    });
  }
};

// Return form-analysis guidance for a specific exercise and optional feedback context.
export const analyzeExerciseForm = async (req, res) => {
  try {
    const { exerciseName, userFeedback } = req.body;
    
    if (!exerciseName || exerciseName.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Exercise name is required' 
      });
    }
    
    const formGuidance = await aiService.analyzeExerciseForm(
      exerciseName, 
      userFeedback || 'General form guidance requested'
    );
    
    res.json({
      success: true,
      data: {
        exercise: exerciseName,
        guidance: formGuidance,
        timestamp: new Date().toISOString()
      },
      message: 'Exercise form analysis completed successfully'
    });
    
  } catch (error) {
    console.error('Error analyzing exercise form:', error);
    res.status(500).json({ 
      error: 'Failed to analyze exercise form',
      details: error.message 
    });
  }
};

// Build a short tips prompt constrained to supported categories.
export const getQuickTips = async (req, res) => {
  try {
    const { category, userLevel } = req.query;
    
    const validCategories = ['workout', 'nutrition', 'recovery', 'motivation', 'general'];
    // Clamp unknown categories to a safe default before generating the AI prompt.
    const selectedCategory = validCategories.includes(category) ? category : 'general';
    
    let question = `Give me 3 quick ${selectedCategory} tips`;
    if (userLevel) {
      question += ` for ${userLevel} level fitness enthusiasts`;
    }
    
    const tips = await aiService.getFitnessCoachAdvice(question, { category, userLevel });
    
    res.json({
      success: true,
      data: {
        category: selectedCategory,
        tips,
        userLevel: userLevel || 'all levels'
      },
      message: 'Quick tips provided successfully'
    });
    
  } catch (error) {
    console.error('Error getting quick tips:', error);
    res.status(500).json({ 
      error: 'Failed to get quick tips',
      details: error.message 
    });
  }
};

// Generate alternative exercises based on reason and available equipment.
export const getExerciseAlternatives = async (req, res) => {
  try {
    const { exerciseName, reason, equipment } = req.body;
    
    if (!exerciseName || !reason) {
      return res.status(400).json({ 
        error: 'Exercise name and reason for alternative are required' 
      });
    }
    
    let question = `I need alternatives to ${exerciseName} because ${reason}.`;
    if (equipment) {
      question += ` Available equipment: ${equipment}.`;
    }
    question += ' Suggest 3-5 alternative exercises with brief descriptions.';
    
    const alternatives = await aiService.getFitnessCoachAdvice(question, { 
      exerciseName, 
      reason, 
      equipment 
    });
    
    res.json({
      success: true,
      data: {
        original_exercise: exerciseName,
        reason,
        alternatives,
        equipment: equipment || 'not specified'
      },
      message: 'Exercise alternatives provided successfully'
    });
    
  } catch (error) {
    console.error('Error getting exercise alternatives:', error);
    res.status(500).json({ 
      error: 'Failed to get exercise alternatives',
      details: error.message 
    });
  }
};

// Generate workout and meal plans together, then save a versioned snapshot.
export const generateAndSavePlan = async (req, res) => {
  try {
    const userProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id }
    });
    const completeProfile = buildCompleteProfile(userProfile, req.body);
    const missing = validateProfileForPlan(completeProfile);

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required profile fields: ${missing.join(', ')}`
      });
    }

    const [workout, diet] = await Promise.all([
      aiService.getWorkoutRecommendations(completeProfile),
      aiService.getMealPlanRecommendations(completeProfile)
    ]);

    const lastPlan = await prisma.plan.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });

    // Increment version per user to preserve historical ordering of generated plans.
    const nextVersion = (lastPlan?.version || 0) + 1;

    const saved = await prisma.plan.create({
      data: {
        userId: req.user.id,
        workout,
        diet,
        duration: completeProfile.duration || 8,
        version: nextVersion,
        schemaVersion: PLAN_SCHEMA_VERSION
      }
    });

    return res.json({
      success: true,
      message: 'Plan generated and saved successfully',
      plan: saved
    });
  } catch (error) {
    console.error('Error generating/saving plan:', error);
    res.status(500).json({ 
      error: 'Failed to generate and save plan',
      details: error.message 
    });
  }
};

// Return the latest saved plan for the authenticated user.
export const getLatestPlan = async (req, res) => {
  try {
    const plan = await prisma.plan.findFirst({
      where: {
        userId: req.user.id,
        schemaVersion: PLAN_SCHEMA_VERSION
      },
      orderBy: { createdAt: 'desc' }
    });
    if (!plan) {
      return res.status(404).json({
        error: 'No current plan found',
        code: 'PLAN_REGENERATION_REQUIRED',
        requiredSchemaVersion: PLAN_SCHEMA_VERSION
      });
    }
    res.json({ success: true, plan });
  } catch (error) {
    console.error('Error fetching latest plan:', error);
    res.status(500).json({ error: 'Failed to fetch latest plan' });
  }
};

export default {
  getWorkoutRecommendations,
  getMealPlanRecommendations,
  getFitnessCoachAdvice,
  analyzeProgress,
  analyzeExerciseForm,
  getQuickTips,
  getExerciseAlternatives,
  generateAndSavePlan,
  getLatestPlan
};
