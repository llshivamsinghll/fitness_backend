import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const makeAICall = async (messages, temperature = 0.7) => {
  try {
    console.log('Making AI call with model: llama-3.1-8b-instant');
    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.1-8b-instant",
      temperature,
      max_tokens: 2048,
    });
    
    const content = completion.choices[0]?.message?.content;
    console.log('AI response received, length:', content?.length || 0);
    return content;
  } catch (error) {
    console.error('Groq AI API Error:', error);
    console.error('Error details:', error.message);
    throw new Error('AI service temporarily unavailable');
  }
};

export const getWorkoutRecommendations = async (userProfile) => {
  const { age, weight, height, gender, fitnessGoal, activityLevel, workoutPreference, injuries = [], duration, name, medicalConditions } = userProfile;
  
  // Ensure duration is from profile, no defaults
  if (!duration) {
    console.warn('No duration provided in user profile, this should not happen');
  }

  const messages = [
    {
      role: "system",
      content: "You are an expert fitness coach. You must respond with ONLY valid JSON. No explanations, no markdown, no text outside the JSON object."
    },
    {
      role: "user", 
      content: `Create a detailed ${duration}-week workout plan for ${name || 'user'}:
Profile: ${age}yo ${gender}, ${weight}kg, ${height}cm
Goal: ${fitnessGoal}
Activity Level: ${activityLevel}
Preferences: ${workoutPreference || 'mixed'}
Injuries: ${injuries.join(', ') || 'None'}
Medical Conditions: ${medicalConditions || 'None'}
Plan Duration: ${duration} weeks exactly

Create a ${duration}-week plan with ${workoutPreference || 'mixed'} workouts.
Workout frequency: Respect the user's preferred workout frequency if specified.

Return ONLY this JSON structure:
{
  "durationWeeks": ${duration},
  "phases": [
    {
      "name": "Foundation Phase", 
      "weeks": "1-${Math.ceil(duration/2)}",
      "days": [
        {
          "name": "Day 1",
          "focus": "Upper Body",
          "exercises": [
            {"name": "Bench Press", "sets": 3, "reps": "8-12", "rest": "60-90s", "notes": "Focus on form"}
          ]
        }
      ]
    }
  ],
  "weekly_plan": {"frequency": "${activityLevel === 'very-active' ? '5-6/week' : activityLevel === 'active' ? '4-5/week' : activityLevel === 'moderate' ? '3-4/week' : activityLevel === 'light' ? '2-3/week' : '3/week'}", "rest_days": "As needed based on activity level"},
  "recommendations": ["Warm up 5-10 minutes", "Focus on proper form", "Plan duration: ${duration} weeks"]
}`
    }
  ];

  try {
    const response = await makeAICall(messages, 0.2);
    console.log('Raw AI Workout Response:', response);
    
    if (!response) {
      throw new Error('No response from AI');
    }
    
    // Multiple parsing attempts
    let parsed = null;
    
    // Attempt 1: Direct JSON parse
    try {
      parsed = JSON.parse(response);
      console.log('Direct JSON parse successful');
    } catch (e) {
      console.log('Direct JSON parse failed:', e.message);
    }
    
    // Attempt 2: Remove markdown and parse
    if (!parsed) {
      try {
        let cleanResponse = response.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(cleanResponse);
        console.log('Markdown removal parse successful');
      } catch (e) {
        console.log('Markdown removal parse failed:', e.message);
      }
    }
    
    // Attempt 3: Extract JSON object
    if (!parsed) {
      try {
        const firstBrace = response.indexOf('{');
        const lastBrace = response.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonStr = response.substring(firstBrace, lastBrace + 1);
          parsed = JSON.parse(jsonStr);
          console.log('JSON extraction parse successful');
        }
      } catch (e) {
        console.log('JSON extraction parse failed:', e.message);
      }
    }
    
    if (parsed && parsed.phases && Array.isArray(parsed.phases) && parsed.phases.length > 0) {
      console.log('Successfully parsed workout with', parsed.phases.length, 'phases');
      return {
        durationWeeks: parsed.durationWeeks || duration,
        phases: parsed.phases,
        weekly_plan: parsed.weekly_plan || { frequency: '3-4/week' },
        recommendations: parsed.recommendations || [],
      };
    } else {
      console.log('Parsed data missing phases, creating structured fallback');
      // Create structured workout plan with multiple phases based on duration
      const phases = [];
      
      if (duration <= 4) {
        // Short plan: Single phase
        phases.push({
          name: "Foundation Phase",
          weeks: `1-${duration}`,
          days: [
            {
              name: "Day 1",
              focus: "Upper Body",
              exercises: [
                { name: "Push-ups", sets: 3, reps: "8-12", rest: "60s", notes: "Modify as needed" },
                { name: "Dumbbell Rows", sets: 3, reps: "8-12", rest: "60s", notes: "Control the weight" },
                { name: "Shoulder Press", sets: 3, reps: "8-10", rest: "60s", notes: "Start light" }
              ]
            },
            {
              name: "Day 2", 
              focus: "Lower Body",
              exercises: [
                { name: "Squats", sets: 3, reps: "10-15", rest: "60s", notes: "Focus on form" },
                { name: "Lunges", sets: 3, reps: "8-12 each leg", rest: "60s", notes: "Keep balance" },
                { name: "Calf Raises", sets: 3, reps: "12-15", rest: "45s", notes: "Full range of motion" }
              ]
            },
            {
              name: "Day 3",
              focus: "Core & Cardio",
              exercises: [
                { name: "Plank", sets: 3, reps: "30-60s", rest: "60s", notes: "Keep core tight" },
                { name: "Mountain Climbers", sets: 3, reps: "20-30", rest: "60s", notes: "Quick movements" },
                { name: "Jumping Jacks", sets: 3, reps: "30-45", rest: "45s", notes: "Cardio boost" }
              ]
            }
          ]
        });
      } else {
        // Longer plan: Multiple phases
        const midPoint = Math.ceil(duration / 2);
        
        // Phase 1: Foundation
        phases.push({
          name: "Foundation Phase",
          weeks: `1-${midPoint}`,
          days: [
            {
              name: "Day 1",
              focus: "Upper Body",
              exercises: [
                { name: "Push-ups", sets: 3, reps: "8-12", rest: "60s", notes: "Build base strength" },
                { name: "Dumbbell Rows", sets: 3, reps: "8-12", rest: "60s", notes: "Control the weight" },
                { name: "Shoulder Press", sets: 3, reps: "8-10", rest: "60s", notes: "Start light" }
              ]
            },
            {
              name: "Day 2",
              focus: "Lower Body", 
              exercises: [
                { name: "Squats", sets: 3, reps: "10-15", rest: "60s", notes: "Perfect your form" },
                { name: "Lunges", sets: 3, reps: "8-12 each leg", rest: "60s", notes: "Balance and control" },
                { name: "Calf Raises", sets: 3, reps: "12-15", rest: "45s", notes: "Full range of motion" }
              ]
            },
            {
              name: "Day 3",
              focus: "Core",
              exercises: [
                { name: "Plank", sets: 3, reps: "30-45s", rest: "60s", notes: "Build core stability" },
                { name: "Bicycle Crunches", sets: 3, reps: "15-20", rest: "45s", notes: "Controlled movement" },
                { name: "Glute Bridges", sets: 3, reps: "12-15", rest: "45s", notes: "Squeeze at top" }
              ]
            }
          ]
        });

        // Phase 2: Progression
        phases.push({
          name: "Progression Phase", 
          weeks: `${midPoint + 1}-${duration}`,
          days: [
            {
              name: "Day 1",
              focus: "Upper Body",
              exercises: [
                { name: "Push-ups", sets: 4, reps: "10-15", rest: "45s", notes: "Increase intensity" },
                { name: "Dumbbell Rows", sets: 4, reps: "10-15", rest: "45s", notes: "Heavier weight" },
                { name: "Shoulder Press", sets: 4, reps: "10-12", rest: "45s", notes: "Progressive overload" },
                { name: "Tricep Dips", sets: 3, reps: "8-12", rest: "60s", notes: "New exercise" }
              ]
            },
            {
              name: "Day 2",
              focus: "Lower Body",
              exercises: [
                { name: "Squats", sets: 4, reps: "12-18", rest: "45s", notes: "Increase reps" },
                { name: "Lunges", sets: 4, reps: "10-15 each leg", rest: "45s", notes: "Add difficulty" },
                { name: "Calf Raises", sets: 4, reps: "15-20", rest: "30s", notes: "Higher volume" },
                { name: "Wall Sit", sets: 3, reps: "30-60s", rest: "60s", notes: "Isometric strength" }
              ]
            },
            {
              name: "Day 3", 
              focus: "Full Body",
              exercises: [
                { name: "Burpees", sets: 3, reps: "6-10", rest: "90s", notes: "High intensity" },
                { name: "Mountain Climbers", sets: 3, reps: "25-35", rest: "60s", notes: "Faster pace" },
                { name: "Plank", sets: 3, reps: "45-90s", rest: "60s", notes: "Longer holds" }
              ]
            }
          ]
        });
      }

      return {
        durationWeeks: duration,
        phases,
        weekly_plan: { 
          frequency: activityLevel === 'very-active' ? '5-6/week' : 
                    activityLevel === 'active' ? '4-5/week' : 
                    activityLevel === 'moderate' ? '3-4/week' : 
                    activityLevel === 'light' ? '2-3/week' : '3/week',
          rest_days: 'As needed based on your activity level'
        },
        recommendations: [
          'Warm up before workouts', 
          'Cool down and stretch after', 
          'Start with lighter weights', 
          'Focus on proper form',
          `Your personalized ${duration}-week plan`,
          `Frequency based on ${activityLevel || 'moderate'} activity level`
        ],
      };
    }
  } catch (error) {
    console.error('Workout generation error:', error);
    console.log('Creating basic structured fallback due to error');
    return {
      durationWeeks: duration,
      phases: [
        {
          name: "Beginner Phase", 
          weeks: `1-${duration}`,
          days: [
            {
              name: "Day 1",
              focus: "Full Body",
              exercises: [
                { name: "Bodyweight Squats", sets: 3, reps: "10-15", rest: "60s", notes: "Start slow" },
                { name: "Push-ups", sets: 3, reps: "5-10", rest: "60s", notes: "Modify on knees if needed" },
                { name: "Walking", sets: 1, reps: "20-30 minutes", rest: "N/A", notes: "Light cardio" }
              ]
            }
          ]
        }
      ],
      weekly_plan: { 
        frequency: activityLevel === 'very-active' ? '4-5/week' : 
                  activityLevel === 'active' ? '3-4/week' :
                  activityLevel === 'light' ? '2/week' : '3/week'
      },
      recommendations: [
        'Start with basic movements', 
        'Listen to your body',
        `Your personalized ${duration}-week plan`,
        `Workout frequency: ${activityLevel || 'moderate'} activity level`
      ],
    };
  }
};

export const getMealPlanRecommendations = async (userProfile) => {
  const { age, weight, height, gender, fitnessGoal, activityLevel, dietPreference, name, medicalConditions, duration, location, cuisine } = userProfile;

  console.log('[AI] Meal Plan Generation - User Profile:', { 
    location, 
    cuisine, 
    dietPreference,
    name,
    fitnessGoal 
  });

  const bmr = gender === 'male' 
    ? 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
    : 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
  
  const dailyCalories = Math.round(bmr * 1.55);

  // Determine regional cuisine preferences
  const regionalContext = location || cuisine || 'International';
  console.log('[AI] Regional Context for Meal Plan:', regionalContext);
  const cuisineGuidance = `
🌍 CRITICAL REQUIREMENT - REGIONAL CUISINE:
You MUST create ALL meals exclusively from ${regionalContext} cuisine.

MANDATORY REGIONAL REQUIREMENTS:
✓ Use ONLY traditional ${regionalContext} dishes and recipes
✓ Use ONLY ingredients commonly available in ${regionalContext} local markets
✓ Follow ${regionalContext} cooking methods and techniques
✓ Include ${regionalContext} traditional spices, herbs, and seasonings
✓ Follow ${regionalContext} cultural meal patterns and timing
✓ Name dishes in local ${regionalContext} language when appropriate
${dietPreference === 'vegetarian' || dietPreference === 'vegan' ? `✓ STRICTLY follow ${dietPreference} dietary restrictions` : ''}
${dietPreference === 'non-vegetarian' ? `✓ Include ${regionalContext} traditional meat, fish, and poultry dishes` : ''}

Example: If region is "India", use dishes like Dosa, Idli, Dal, Roti, Paneer, etc.
Example: If region is "Italy", use dishes like Pasta, Risotto, Bruschetta, etc.
Example: If region is "Japan", use dishes like Miso Soup, Onigiri, Teriyaki, etc.`;

  const messages = [
    {
      role: "system",
      content: `You are a certified nutritionist specializing in ${regionalContext} cuisine. You MUST create meal plans using ONLY traditional ${regionalContext} dishes, ingredients, and cooking methods. You must respond with ONLY valid JSON. No explanations, no markdown, no text outside the JSON object.`
    },
    {
      role: "user",
      content: `Create a personalized meal plan using EXCLUSIVELY ${regionalContext} cuisine for ${name || 'user'}:

USER PROFILE:
- Age: ${age} years old
- Gender: ${gender}
- Weight: ${weight} kg
- Height: ${height} cm
- Fitness Goal: ${fitnessGoal}
- Activity Level: ${activityLevel}
- Diet Preference: ${dietPreference || 'none'}
- Region/Location: ${regionalContext}
- Medical Conditions: ${medicalConditions || 'None'}
- Plan Duration: ${duration} weeks
- Target Daily Calories: ${dailyCalories}

${cuisineGuidance}

MEAL PLAN REQUIREMENTS:
- Create a weekly meal plan with 4-5 meals per day
- ALL meals MUST be from ${regionalContext} cuisine ONLY
- Use traditional ${regionalContext} dish names
- Include breakfast, lunch, dinner, and snacks typical to ${regionalContext} culture
- Use ingredients commonly found in ${regionalContext} local markets
- Follow ${regionalContext} traditional cooking methods

Return ONLY this JSON structure:
{
  "region": "${regionalContext}",
  "daily_targets": {
    "calories": ${dailyCalories},
    "protein": 150,
    "carbs": 200,
    "fat": 75,
    "fiber": 25
  },
  "weekly_plan": [
    {
      "day": 1,
      "meals": [
        {
          "meal_type": "Breakfast",
          "name": "Traditional ${regionalContext} breakfast dish",
          "total_calories": 400,
          "protein": 20,
          "carbs": 45,
          "fat": 15,
          "prep_time": "15 minutes",
          "foods": [
            {"name": "Local ingredient 1", "quantity": "1 cup", "calories": 150, "protein": 5, "carbs": 27, "fat": 3}
          ],
          "recipe_notes": "Brief cooking instructions using local methods"
        }
      ]
    }
  ],
  "regional_tips": ["Hydration tips for ${regionalContext} climate", "Local eating habits", "Meal timing based on ${regionalContext} culture"],
  "shopping_list": ["Local ingredients commonly found in ${regionalContext} markets"],
  "meal_prep_tips": ["Tips specific to ${regionalContext} cooking methods"]
}`
    }
  ];

  try {
    const response = await makeAICall(messages, 0.2);
    console.log('Raw AI Meal Response:', response?.substring(0, 500) + '...');
    
    // Try to extract JSON from response
    let cleanResponse = response.replace(/```json|```/g, '').trim();
    
    // Find first { and last } to extract JSON object
    const firstBrace = cleanResponse.indexOf('{');
    const lastBrace = cleanResponse.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanResponse = cleanResponse.substring(firstBrace, lastBrace + 1);
    }
    
    const parsed = JSON.parse(cleanResponse);
    
    return {
      daily_targets: parsed.daily_targets || { calories: dailyCalories },
      meals: parsed.meals || [],
      tips: parsed.tips || [],
      shopping_list: parsed.shopping_list || [],
    };
  } catch (error) {
    console.error('Meal plan generation error:', error);
    return {
      daily_targets: { calories: dailyCalories },
      meals: [],
      tips: ['Eat balanced meals'],
      shopping_list: [],
    };
  }
};

export const getFitnessCoachAdvice = async (question, userContext = {}) => {
  const messages = [
    {
      role: "system",
      content: "You are a fitness coach."
    },
    {
      role: "user",
      content: `Question: ${question}`
    }
  ];

  try {
    const response = await makeAICall(messages);
    return {
      advice: response,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      advice: 'Service unavailable.',
      timestamp: new Date().toISOString()
    };
  }
};

export default {
  getWorkoutRecommendations,
  getMealPlanRecommendations,
  getFitnessCoachAdvice
};
