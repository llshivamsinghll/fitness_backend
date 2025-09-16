import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Helper function to make AI calls with error handling
const makeAICall = async (messages, temperature = 0.7) => {
  try {
    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.1-8b-instant", // Updated to working model
      temperature,
      max_tokens: 1024,
    });
    
    return completion.choices[0]?.message?.content;
  } catch (error) {
    console.error('Groq AI API Error:', error);
    throw new Error('AI service temporarily unavailable');
  }
};

// Generate personalized workout recommendations
export const getWorkoutRecommendations = async (userProfile) => {
  const { age, weight, height, fitnessGoal, activityLevel, workoutPreference, injuries = [] } = userProfile;
  
  const messages = [
    {
      role: "system",
      content: "You are an expert fitness coach. You MUST respond with valid JSON only. Do not include any explanatory text, markdown formatting, or code blocks. Return only the pure JSON object."
    },
    {
      role: "user",
      content: `Create a personalized workout plan for a ${age}-year-old person weighing ${weight}kg, height ${height}cm, with fitness goal: ${fitnessGoal}, activity level: ${activityLevel}, workout preference: ${workoutPreference}, and injuries/limitations: ${injuries.join(', ') || 'None'}.

Respond with ONLY this JSON structure (no additional text or formatting):
{
  "recommendations": [
    {
      "name": "Exercise Name",
      "sets": 3,
      "reps": "8-12",
      "duration": "45 minutes",
      "difficulty": "Beginner",
      "muscle_groups": ["chest", "shoulders"],
      "description": "Exercise instructions and form tips"
    }
  ],
  "weekly_plan": {
    "frequency": "3-4 times per week",
    "rest_days": "Every other day",
    "progression": "Increase weight by 5% each week"
  },
  "tips": ["Warm up properly", "Focus on form", "Stay hydrated"]
}`
    }
  ];
  
  const response = await makeAICall(messages, 0.7);
  
  console.log('Raw AI Response:', response);
  
  try {
    // Clean the response to remove any potential markdown formatting
    let cleanedResponse = response.trim();
    
    // Remove code block markers if present
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
    }
    
    // Parse the cleaned JSON
    const parsed = JSON.parse(cleanedResponse);
    
    // Validate the structure
    if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
      throw new Error('Invalid structure: missing recommendations array');
    }
    
    return parsed;
  } catch (error) {
    console.error('JSON parsing error:', error, 'Raw response:', response);
    
    // If JSON parsing fails, return structured fallback
    return {
      recommendations: [{
        name: "Custom Workout Plan",
        sets: 3,
        reps: "8-12",
        duration: "45 minutes",
        difficulty: "Moderate",
        muscle_groups: ["full-body"],
        description: "AI-generated workout plan based on your profile. Please try generating again for a structured plan."
      }],
      weekly_plan: {
        frequency: "3-4 times per week",
        rest_days: "Every other day",
        progression: "Increase intensity gradually"
      },
      tips: ["Always warm up before exercising", "Listen to your body", "Stay hydrated", "Focus on proper form"]
    };
  }
};

// Generate personalized meal plans
export const getMealPlanRecommendations = async (userProfile) => {
  const { age, weight, height, fitnessGoal, activityLevel, dietaryRestrictions = [], allergies = [] } = userProfile;
  
  // Calculate approximate daily calories needed
  const bmr = weight * 22; // Simplified BMR calculation
  const activityMultiplier = {
    'sedentary': 1.2,
    'light': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'very_active': 1.9
  };
  const dailyCalories = Math.round(bmr * (activityMultiplier[activityLevel] || 1.4));
  
  const messages = [
    {
      role: "system",
      content: "You are a certified nutritionist. Provide personalized meal plans in JSON format with detailed nutritional information."
    },
    {
      role: "user",
      content: `Create a personalized daily meal plan for:
      - Age: ${age}
      - Weight: ${weight}kg
      - Height: ${height}cm
      - Fitness Goal: ${fitnessGoal}
      - Activity Level: ${activityLevel}
      - Target Daily Calories: ${dailyCalories}
      - Dietary Restrictions: ${dietaryRestrictions.join(', ') || 'None'}
      - Allergies: ${allergies.join(', ') || 'None'}
      
      Respond with JSON in this format:
      {
        "daily_targets": {
          "calories": ${dailyCalories},
          "protein": 120,
          "carbs": 200,
          "fat": 70,
          "fiber": 25
        },
        "meals": [
          {
            "meal_type": "Breakfast",
            "foods": [
              {
                "name": "Food item",
                "quantity": "1 cup",
                "calories": 150,
                "protein": 8,
                "carbs": 25,
                "fat": 3
              }
            ],
            "total_calories": 300,
            "prep_time": "10 minutes"
          }
        ],
        "tips": ["Hydration tip", "Timing tip", "Preparation tip"],
        "shopping_list": ["ingredient 1", "ingredient 2"]
      }`
    }
  ];
  
  const response = await makeAICall(messages, 0.7);
  
  try {
    return JSON.parse(response);
  } catch (error) {
    return {
      daily_targets: { calories: dailyCalories, protein: 120, carbs: 200, fat: 70 },
      meals: [{
        meal_type: "Personalized Meal Plan",
        description: response,
        total_calories: dailyCalories / 3
      }],
      tips: ["Eat balanced meals", "Stay hydrated", "Plan your meals ahead"]
    };
  }
};

// AI Fitness Coach Chat
export const getFitnessCoachAdvice = async (question, userContext = {}) => {
  const messages = [
    {
      role: "system",
      content: `You are an experienced fitness coach and nutritionist. Provide helpful, motivational, and scientifically-backed advice in structured JSON format.`
    },
    {
      role: "user",
      content: `Question: "${question}"
      User Context: ${JSON.stringify(userContext)}
      
      Respond with JSON in this format:
      {
        "response_type": "advice/tip/explanation/motivation",
        "main_answer": "Direct answer to the question",
        "key_points": [
          {
            "title": "Point title",
            "description": "Detailed explanation",
            "importance": "High/Medium/Low"
          }
        ],
        "action_steps": ["Step 1", "Step 2", "Step 3"],
        "pro_tips": ["Expert tip 1", "Expert tip 2"],
        "safety_notes": ["Safety consideration if applicable"],
        "motivation": "Encouraging closing message"
      }`
    }
  ];
  
  const response = await makeAICall(messages, 0.8);
  
  try {
    return JSON.parse(response);
  } catch (error) {
    // If JSON parsing fails, return structured fallback
    return {
      response_type: "advice",
      main_answer: response,
      key_points: [],
      action_steps: [],
      pro_tips: ["Stay consistent with your fitness journey!"],
      safety_notes: [],
      motivation: "You've got this! Keep pushing towards your goals! 💪"
    };
  }
};

// Progress Analysis and Recommendations
export const analyzeProgress = async (progressData) => {
  const { workoutHistory, weightHistory, goalProgress, timeframe } = progressData;
  
  const messages = [
    {
      role: "system",
      content: "You are a fitness analyst. Analyze user progress data and provide actionable insights and recommendations."
    },
    {
      role: "user",
      content: `Analyze my fitness progress and provide recommendations:
      
      Workout History (last ${timeframe}): ${JSON.stringify(workoutHistory)}
      Weight Progress: ${JSON.stringify(weightHistory)}
      Goal Progress: ${JSON.stringify(goalProgress)}
      
      Provide analysis in JSON format:
      {
        "progress_summary": "Overall assessment",
        "strengths": ["What's going well"],
        "areas_for_improvement": ["What needs work"],
        "recommendations": [
          {
            "category": "Workout/Nutrition/Recovery",
            "suggestion": "Specific recommendation",
            "priority": "High/Medium/Low"
          }
        ],
        "motivation": "Encouraging message"
      }`
    }
  ];
  
  const response = await makeAICall(messages, 0.6);
  
  try {
    return JSON.parse(response);
  } catch (error) {
    return {
      progress_summary: response,
      recommendations: [{
        category: "General",
        suggestion: "Keep up the consistent effort!",
        priority: "Medium"
      }]
    };
  }
};

// Form and Technique Analysis
export const analyzeExerciseForm = async (exerciseName, userFeedback) => {
  const messages = [
    {
      role: "system",
      content: "You are a certified personal trainer specializing in proper exercise form and injury prevention. Provide structured form guidance."
    },
    {
      role: "user",
      content: `Analyze form for ${exerciseName}. User feedback: "${userFeedback}"
      
      Respond with JSON in this format:
      {
        "exercise": "${exerciseName}",
        "form_checklist": [
          {
            "step": "Setup position",
            "description": "How to position yourself",
            "key_focus": "What to pay attention to"
          }
        ],
        "common_mistakes": [
          {
            "mistake": "Common error",
            "why_avoid": "Why this is problematic",
            "correction": "How to fix it"
          }
        ],
        "modifications": {
          "beginner": ["Easier variation 1", "Easier variation 2"],
          "advanced": ["Challenging variation 1", "Challenging variation 2"]
        },
        "safety_tips": ["Safety point 1", "Safety point 2"],
        "progression": "How to advance with this exercise"
      }`
    }
  ];
  
  const response = await makeAICall(messages, 0.7);
  
  try {
    return JSON.parse(response);
  } catch (error) {
    return {
      exercise: exerciseName,
      form_checklist: [],
      common_mistakes: [],
      modifications: { beginner: [], advanced: [] },
      safety_tips: ["Always maintain proper form", "Start with lighter weights"],
      progression: response
    };
  }
};

export default {
  getWorkoutRecommendations,
  getMealPlanRecommendations,
  getFitnessCoachAdvice,
  analyzeProgress,
  analyzeExerciseForm
};