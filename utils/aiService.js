import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const makeAICall = async (messages, temperature = 0.7, maxTokens = 2048) => {
  try {
    console.log('Making AI call with model: llama-3.1-8b-instant');
    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.1-8b-instant",
      temperature,
      max_tokens: maxTokens,
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
    let parsed = null;
    try {
      parsed = JSON.parse(response);
      console.log('Direct JSON parse successful');
    } catch (e) {
      console.log('Direct JSON parse failed:', e.message);
    }
    if (!parsed) {
      try {
        let cleanResponse = response.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(cleanResponse);
        console.log('Markdown removal parse successful');
      } catch (e) {
        console.log('Markdown removal parse failed:', e.message);
      }
    }
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
      const phases = [];
      
      if (duration <= 4) {
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
        const midPoint = Math.ceil(duration / 2);
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

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeMeal = (meal = {}) => {
  const foods = Array.isArray(meal.foods) ? meal.foods : [];
  const foodsCalories = foods.reduce((sum, item) => sum + toNumber(item?.calories, 0), 0);
  const calories = toNumber(meal.calories, toNumber(meal.total_calories, foodsCalories));

  return {
    meal_type: meal.meal_type || 'Meal',
    name: meal.name || 'Unnamed meal',
    calories,
    total_calories: toNumber(meal.total_calories, calories),
    protein: toNumber(meal.protein, 0),
    carbs: toNumber(meal.carbs, 0),
    fat: toNumber(meal.fat, 0),
    prep_time: meal.prep_time || '',
    foods,
    recipe_notes: meal.recipe_notes || ''
  };
};

const normalizeWeeklyPlan = (rawWeeklyPlan) => {
  if (!Array.isArray(rawWeeklyPlan)) return [];

  return rawWeeklyPlan.map((day, index) => {
    const meals = Array.isArray(day?.meals) ? day.meals.map(normalizeMeal) : [];
    return {
      day: toNumber(day?.day, index + 1),
      meals
    };
  });
};

const normalizeDietPayload = (parsed, dailyCalories) => {
  const source = parsed && typeof parsed === 'object' ? parsed : {};

  const weeklyFromWeeklyPlan = normalizeWeeklyPlan(source.weekly_plan);
  const weeklyFromDays = weeklyFromWeeklyPlan.length === 0 ? normalizeWeeklyPlan(source.days) : [];
  const directMeals = Array.isArray(source.meals) ? source.meals.map(normalizeMeal) : [];

  const weekly_plan = weeklyFromWeeklyPlan.length > 0
    ? weeklyFromWeeklyPlan
    : weeklyFromDays.length > 0
      ? weeklyFromDays
      : directMeals.length > 0
        ? [{ day: 1, meals: directMeals }]
        : [];

  const meals = weekly_plan.flatMap((day) => day.meals);

  const mergedTips = [
    ...(Array.isArray(source.tips) ? source.tips : []),
    ...(Array.isArray(source.regional_tips) ? source.regional_tips : []),
    ...(Array.isArray(source.meal_prep_tips) ? source.meal_prep_tips : [])
  ];

  return {
    schemaVersion: 2,
    region: source.region || null,
    daily_targets: {
      calories: toNumber(source.daily_targets?.calories, dailyCalories),
      protein: toNumber(source.daily_targets?.protein, 0),
      carbs: toNumber(source.daily_targets?.carbs, 0),
      fat: toNumber(source.daily_targets?.fat, 0),
      fiber: toNumber(source.daily_targets?.fiber, 0)
    },
    weekly_plan,
    meals,
    tips: [...new Set(mergedTips.filter(Boolean))],
    shopping_list: Array.isArray(source.shopping_list) ? source.shopping_list : []
  };
};

const buildRegionalFallbackDiet = (regionalContext, dailyCalories, dietPreference, location, state) => {
  const region = (regionalContext || location || 'International').toLowerCase();
  const stateName = (state || '').toLowerCase();

  const regionMeals = {
    india: [
      { meal_type: 'Breakfast', name: 'Idli with Sambar', protein: 14, carbs: 52, fat: 8 },
      { meal_type: 'Lunch', name: 'Dal, Rice, and Seasonal Sabzi', protein: 26, carbs: 78, fat: 14 },
      { meal_type: 'Snack', name: 'Roasted Chana and Buttermilk', protein: 14, carbs: 22, fat: 5 },
      { meal_type: 'Dinner', name: 'Chapati with Paneer Bhurji', protein: 34, carbs: 48, fat: 20 }
    ],
    italy: [
      { meal_type: 'Breakfast', name: 'Wholegrain Toast with Ricotta and Fruit', protein: 16, carbs: 45, fat: 11 },
      { meal_type: 'Lunch', name: 'Chicken Risotto with Vegetables', protein: 34, carbs: 70, fat: 16 },
      { meal_type: 'Snack', name: 'Greek Yogurt with Nuts', protein: 17, carbs: 18, fat: 10 },
      { meal_type: 'Dinner', name: 'Grilled Fish with Minestrone', protein: 36, carbs: 36, fat: 16 }
    ],
    japan: [
      { meal_type: 'Breakfast', name: 'Miso Soup, Rice, and Grilled Fish', protein: 24, carbs: 48, fat: 12 },
      { meal_type: 'Lunch', name: 'Chicken Teriyaki Bowl', protein: 34, carbs: 64, fat: 14 },
      { meal_type: 'Snack', name: 'Edamame and Fruit', protein: 13, carbs: 24, fat: 4 },
      { meal_type: 'Dinner', name: 'Tofu Stir-fry with Soba', protein: 30, carbs: 50, fat: 14 }
    ],
    international: [
      { meal_type: 'Breakfast', name: 'Oats with Milk and Fruit', protein: 18, carbs: 50, fat: 10 },
      { meal_type: 'Lunch', name: 'Grilled Chicken with Rice and Veggies', protein: 36, carbs: 68, fat: 14 },
      { meal_type: 'Snack', name: 'Yogurt and Nuts', protein: 15, carbs: 20, fat: 9 },
      { meal_type: 'Dinner', name: 'Salmon with Quinoa and Salad', protein: 34, carbs: 42, fat: 18 }
    ]
  };

  const indianStateMeals = {
    maharashtra: [
      { meal_type: 'Breakfast', name: 'Poha with Peanuts', protein: 12, carbs: 58, fat: 10 },
      { meal_type: 'Lunch', name: 'Varan Bhaat with Bhindi Sabzi', protein: 22, carbs: 82, fat: 14 },
      { meal_type: 'Snack', name: 'Sprouts Chaat', protein: 14, carbs: 28, fat: 6 },
      { meal_type: 'Dinner', name: 'Jowar Bhakri with Pithla', protein: 26, carbs: 56, fat: 16 }
    ],
    tamilnadu: [
      { meal_type: 'Breakfast', name: 'Idli with Sambar', protein: 14, carbs: 52, fat: 8 },
      { meal_type: 'Lunch', name: 'Sambar Rice with Poriyal', protein: 20, carbs: 86, fat: 14 },
      { meal_type: 'Snack', name: 'Sundal', protein: 12, carbs: 24, fat: 5 },
      { meal_type: 'Dinner', name: 'Dosa with Tomato Chutney', protein: 18, carbs: 60, fat: 12 }
    ],
    gujarat: [
      { meal_type: 'Breakfast', name: 'Thepla with Curd', protein: 12, carbs: 54, fat: 11 },
      { meal_type: 'Lunch', name: 'Gujarati Dal with Rice and Shaak', protein: 20, carbs: 80, fat: 14 },
      { meal_type: 'Snack', name: 'Dhokla', protein: 10, carbs: 30, fat: 4 },
      { meal_type: 'Dinner', name: 'Bajra Rotla with Ringan Bharta', protein: 24, carbs: 52, fat: 14 }
    ],
    punjab: [
      { meal_type: 'Breakfast', name: 'Besan Chilla with Curd', protein: 18, carbs: 36, fat: 10 },
      { meal_type: 'Lunch', name: 'Rajma Chawal with Salad', protein: 24, carbs: 86, fat: 14 },
      { meal_type: 'Snack', name: 'Roasted Makhana', protein: 8, carbs: 20, fat: 4 },
      { meal_type: 'Dinner', name: 'Roti with Palak Paneer', protein: 30, carbs: 46, fat: 20 }
    ],
    bengal: [
      { meal_type: 'Breakfast', name: 'Chirer Pulao', protein: 10, carbs: 52, fat: 9 },
      { meal_type: 'Lunch', name: 'Masoor Dal with Rice and Aloo Bhaja', protein: 18, carbs: 84, fat: 14 },
      { meal_type: 'Snack', name: 'Ghugni', protein: 11, carbs: 32, fat: 5 },
      { meal_type: 'Dinner', name: 'Luchi with Cholar Dal', protein: 18, carbs: 58, fat: 18 }
    ]
  };

  const stateSpecificIndiaMeals = Object.entries(indianStateMeals).find(([key]) => stateName.includes(key))?.[1];

  const selectedMeals = region.includes('india')
    ? stateSpecificIndiaMeals || regionMeals.india
    : region.includes('italy')
      ? regionMeals.italy
      : region.includes('japan')
        ? regionMeals.japan
        : regionMeals.international;

  const caloriesPerMeal = Math.max(300, Math.round(dailyCalories / selectedMeals.length));

  const meals = selectedMeals.map((meal) => ({
    ...meal,
    calories: caloriesPerMeal,
    total_calories: caloriesPerMeal,
    prep_time: '20-30 minutes',
    foods: [],
    recipe_notes: `Use ingredients commonly available in ${state || regionalContext || 'your area'}.`
  }));

  const adjustedMeals = (dietPreference === 'vegetarian' || dietPreference === 'vegan')
    ? meals.map((meal) => ({
        ...meal,
        name: meal.name
          .replace('Chicken', 'Tofu')
          .replace('Fish', 'Paneer')
          .replace('Salmon', 'Soy Paneer')
      }))
    : meals;

  return {
    schemaVersion: 2,
    region: regionalContext || location || 'International',
    daily_targets: {
      calories: dailyCalories,
      protein: 120,
      carbs: 220,
      fat: 70,
      fiber: 25
    },
    weekly_plan: [{ day: 1, meals: adjustedMeals }],
    meals: adjustedMeals,
    tips: [
      `Prioritize locally available foods in ${state || regionalContext || 'your area'}.`,
      'Adjust portions to match your daily calorie target.',
      'Keep hydration and meal timing consistent.'
    ],
    shopping_list: []
  };
};

const tryParseMealResponse = (rawResponse) => {
  if (!rawResponse || typeof rawResponse !== 'string') return null;

  const attempts = [];
  attempts.push(rawResponse.trim());
  attempts.push(rawResponse.replace(/```json|```/g, '').trim());

  const withoutFences = rawResponse.replace(/```json|```/g, '').trim();
  const firstBrace = withoutFences.indexOf('{');
  if (firstBrace !== -1) {
    let inString = false;
    let escaped = false;
    let depth = 0;
    for (let i = firstBrace; i < withoutFences.length; i++) {
      const ch = withoutFences[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
        if (depth === 0) {
          attempts.push(withoutFences.substring(firstBrace, i + 1));
          break;
        }
      }
    }
  }

  for (const candidate of attempts) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
    }
  }

  return null;
};

export const getMealPlanRecommendations = async (userProfile) => {
  const { age, weight, height, gender, fitnessGoal, activityLevel, dietPreference, name, medicalConditions, duration, location, state, cuisine } = userProfile;

  console.log('[AI] Meal Plan Generation - User Profile:', {
    location,
    state,
    cuisine,
    dietPreference,
    name,
    fitnessGoal
  });

  const bmr = gender === 'male' 
    ? 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
    : 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
  
  const dailyCalories = Math.round(bmr * 1.55);
  const regionalContext = state && location
    ? `${state}, ${location}`
    : location || cuisine || 'International';
  console.log('[AI] Regional Context for Meal Plan:', regionalContext);
  const cuisineGuidance = `
?? CRITICAL REQUIREMENT - REGIONAL CUISINE:
You MUST create ALL meals exclusively from ${regionalContext} cuisine.

MANDATORY REGIONAL REQUIREMENTS:
? Use ONLY traditional ${regionalContext} dishes and recipes
? Use ONLY ingredients commonly available in ${regionalContext} local markets
? Follow ${regionalContext} cooking methods and techniques
? Include ${regionalContext} traditional spices, herbs, and seasonings
? Follow ${regionalContext} cultural meal patterns and timing
? Name dishes in local ${regionalContext} language when appropriate
${dietPreference === 'vegetarian' || dietPreference === 'vegan' ? `? STRICTLY follow ${dietPreference} dietary restrictions` : ''}
${dietPreference === 'non-vegetarian' ? `? Include ${regionalContext} traditional meat, fish, and poultry dishes` : ''}

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
- State/Region: ${state || 'Not specified'}
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
    const response = await makeAICall(messages, 0.2, 4096);
    const rawResponse = typeof response === 'string' ? response : '';
    console.log('Raw AI Meal Response:', rawResponse.substring(0, 500) + '...');

    let parsed = tryParseMealResponse(rawResponse);

    if (!parsed) {
      console.warn('[AI] Meal response parse failed. Attempting JSON repair pass.');
      const repairMessages = [
        {
          role: 'system',
          content: 'Convert the provided text into valid JSON only. Return only JSON with keys: region, daily_targets, weekly_plan, regional_tips, shopping_list, meal_prep_tips.'
        },
        {
          role: 'user',
          content: `Repair this into valid JSON, preserving as much data as possible:\n\n${rawResponse}`
        }
      ];

      const repaired = await makeAICall(repairMessages, 0.1, 2048);
      parsed = tryParseMealResponse(typeof repaired === 'string' ? repaired : '');
    }

    if (!parsed) {
      throw new Error('Meal response could not be parsed as valid JSON');
    }

    const normalizedDiet = normalizeDietPayload(parsed, dailyCalories);
    if (normalizedDiet.meals.length === 0) {
      console.warn('[AI] Parsed meal payload has no meals. Using regional fallback meal plan.');
      return buildRegionalFallbackDiet(regionalContext, dailyCalories, dietPreference, location, state);
    }

    return normalizedDiet;
  } catch (error) {
    console.error('Meal plan generation error:', error);
    return buildRegionalFallbackDiet(regionalContext, dailyCalories, dietPreference, location, state);
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
