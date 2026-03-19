import aiService from '../utils/aiService.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Generate workout guidance using persisted profile values with request-body fallback.
export const getWorkoutRecommendations = async (req, res) => {
  try {
    const { age, weight, height, fitnessGoal, activityLevel, workoutPreference, injuries } = req.body;
    const dbProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id }
    });

    // Prefer database profile fields so repeated requests produce consistent personalization.
    const userProfile = {
      age: parseInt(dbProfile?.age || age),
      weight: parseFloat(dbProfile?.weight || weight),
      height: parseFloat(dbProfile?.height || height),
      gender: dbProfile?.gender || 'not-specified',
      fitnessGoal: dbProfile?.fitnessGoal || fitnessGoal,
      activityLevel: dbProfile?.activityLevel || activityLevel,
      workoutPreference: dbProfile?.workoutPreference || workoutPreference || 'mixed',
      injuries: dbProfile?.injuries || injuries || [],
      name: dbProfile?.name || 'User'
    };
    
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
    const { 
      age, 
      weight, 
      height, 
      fitnessGoal, 
      activityLevel, 
      dietaryRestrictions, 
      allergies 
    } = req.body;
    const dbProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id }
    });

    // Persisted profile data takes precedence to avoid drift from partial request payloads.
    const userProfile = {
      age: parseInt(dbProfile?.age || age),
      weight: parseFloat(dbProfile?.weight || weight),
      height: parseFloat(dbProfile?.height || height),
      gender: dbProfile?.gender || 'not-specified',
      fitnessGoal: dbProfile?.fitnessGoal || fitnessGoal,
      activityLevel: dbProfile?.activityLevel || activityLevel,
      dietPreference: dbProfile?.dietPreference || 'none',
      dietaryRestrictions: dietaryRestrictions || [],
      allergies: allergies || [],
      name: dbProfile?.name || 'User',
      location: dbProfile?.location || null,
      cuisine: dbProfile?.cuisine || null
    };
    
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
    const { age, weight, height, gender, fitnessGoal, activityLevel, dietPreference, planDuration, name, location, state, cuisine } = req.body;

    if (!age || !weight || !height || !fitnessGoal || !activityLevel) {
      return res.status(400).json({ 
        error: 'Missing required fields: age, weight, height, fitnessGoal, activityLevel' 
      });
    }
    const userProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id }
    });
    const completeProfile = {
      age: parseInt(userProfile?.age || age) || 25,
      weight: parseFloat(userProfile?.weight || weight) || 70,
      height: parseFloat(userProfile?.height || height) || 170,
      gender: userProfile?.gender || gender || 'not-specified',
      fitnessGoal: userProfile?.fitnessGoal || fitnessGoal || 'general-fitness',
      activityLevel: userProfile?.activityLevel || activityLevel || 'moderate',
      dietPreference: userProfile?.dietPreference || dietPreference || 'none',
      duration: parseInt(userProfile?.planDuration || planDuration) || 8,
      name: userProfile?.name || name || 'User',
      workoutPreference: userProfile?.workoutPreference || 'mixed',
      injuries: userProfile?.injuries || [],
      medicalConditions: userProfile?.medicalConditions || 'none',
      location: userProfile?.location || location || null,
      state: userProfile?.state || state || null,
      cuisine: userProfile?.cuisine || cuisine || null
    };
    const [workout, diet] = await Promise.all([
      aiService.getWorkoutRecommendations(completeProfile),
      aiService.getMealPlanRecommendations(completeProfile)
    ]);

    // Normalize diet fields before persistence so downstream consumers read a stable schema.
    const safeDiet = {
      schemaVersion: Number(diet?.schemaVersion) || 2,
      region: diet?.region || null,
      daily_targets: {
        calories: Number(diet?.daily_targets?.calories) || 0,
        protein: Number(diet?.daily_targets?.protein) || 0,
        carbs: Number(diet?.daily_targets?.carbs) || 0,
        fat: Number(diet?.daily_targets?.fat) || 0,
        fiber: Number(diet?.daily_targets?.fiber) || 0
      },
      weekly_plan: Array.isArray(diet?.weekly_plan) ? diet.weekly_plan : [],
      meals: Array.isArray(diet?.meals) ? diet.meals : [],
      tips: Array.isArray(diet?.tips) ? diet.tips : [],
      shopping_list: Array.isArray(diet?.shopping_list) ? diet.shopping_list : []
    };
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
        diet: safeDiet,
        duration: completeProfile.duration || 8,
        version: nextVersion
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
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    if (!plan) return res.status(404).json({ error: 'No plan found' });
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