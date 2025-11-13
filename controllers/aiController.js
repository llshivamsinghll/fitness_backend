import aiService from '../utils/aiService.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Generate personalized workout recommendations
export const getWorkoutRecommendations = async (req, res) => {
  try {
    const { age, weight, height, fitnessGoal, activityLevel, workoutPreference, injuries } = req.body;
    
    // Get user's complete profile from database
    const dbProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id }
    });
    
    // Use database profile data with request body as fallback
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

// Generate personalized meal plans
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
    
    // Get user's complete profile from database
    const dbProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id }
    });
    
    // Use database profile data with request body as fallback
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

// AI Fitness Coach Chat
export const getFitnessCoachAdvice = async (req, res) => {
  try {
    const { question, userContext } = req.body;
    
    if (!question || question.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Question is required' 
      });
    }
    
    // Limit question length for safety
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

// Analyze user progress and provide recommendations
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

// Analyze exercise form and provide guidance
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

// Get quick fitness tips
export const getQuickTips = async (req, res) => {
  try {
    const { category, userLevel } = req.query;
    
    const validCategories = ['workout', 'nutrition', 'recovery', 'motivation', 'general'];
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

// Get AI-powered exercise alternatives
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

// Generate both workout and meal plan, then save as a Plan record
export const generateAndSavePlan = async (req, res) => {
  try {
    const { age, weight, height, gender, fitnessGoal, activityLevel, dietPreference, planDuration, name } = req.body;

    if (!age || !weight || !height || !fitnessGoal || !activityLevel) {
      return res.status(400).json({ 
        error: 'Missing required fields: age, weight, height, fitnessGoal, activityLevel' 
      });
    }

    // Get user's complete profile from database
    const userProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id }
    });
    
    // Use database profile data with request body as fallback
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
      location: userProfile?.location || null,
      cuisine: userProfile?.cuisine || null
    };

    console.log('Using complete profile for AI generation:', completeProfile);

    // Generate in parallel, passing complete profile to AI service
    const [workout, diet] = await Promise.all([
      aiService.getWorkoutRecommendations(completeProfile),
      aiService.getMealPlanRecommendations(completeProfile)
    ]);

    // Determine next version
    const lastPlan = await prisma.plan.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    const nextVersion = (lastPlan?.version || 0) + 1;

    const saved = await prisma.plan.create({
      data: {
        userId: req.user.id,
        workout,
        diet,
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

// Get most recent saved plan for the authenticated user
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