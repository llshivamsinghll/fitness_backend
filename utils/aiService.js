import Groq from 'groq-sdk';
import {
  calculateDailyTargets,
  getTrainingFrequency,
  normalizeActivityLevel,
  normalizeDietPlan,
  normalizeDurationWeeks,
  normalizeFitnessGoal,
  normalizeWorkoutPlan
} from './planSchema.js';

let groqClient;

const MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const getGroqClient = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is missing or empty');
  }

  if (!groqClient) {
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  return groqClient;
};

const makeAICall = async (messages, temperature = 0.4, maxTokens = 4096) => {
  try {
    console.log('[AI] Making AI call with model:', MODEL);
    const completion = await getGroqClient().chat.completions.create({
      messages,
      model: MODEL,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content;
    console.log('[AI] Response received, length:', content?.length || 0);
    return content;
  } catch (error) {
    console.error('[AI] Groq API error:', error?.message || error);
    throw new Error('AI service temporarily unavailable');
  }
};

const parseJsonObject = (rawResponse) => {
  if (!rawResponse || typeof rawResponse !== 'string') return null;

  const cleaned = rawResponse.replace(/```json|```/g, '').trim();
  const attempts = [cleaned];

  const firstBrace = cleaned.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = firstBrace; i < cleaned.length; i++) {
      const ch = cleaned[i];
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
          attempts.push(cleaned.slice(firstBrace, i + 1));
          break;
        }
      }
    }
  }

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
    }
  }

  return null;
};

const normalizeProfile = (profile = {}) => {
  const duration = normalizeDurationWeeks(profile.duration || profile.planDuration);
  const activityLevel = normalizeActivityLevel(profile.activityLevel);
  const fitnessGoal = normalizeFitnessGoal(profile.fitnessGoal);

  return {
    ...profile,
    age: Number(profile.age) || 25,
    weight: Number(profile.weight) || 70,
    height: Number(profile.height) || 170,
    gender: profile.gender || 'not-specified',
    fitnessGoal,
    activityLevel,
    dietPreference: profile.dietPreference || 'none',
    duration,
    name: profile.name || 'User',
    medicalConditions: profile.medicalConditions || 'none',
    injuries: Array.isArray(profile.injuries) ? profile.injuries : [],
    location: profile.location || null,
    state: profile.state || null,
    cuisine: profile.cuisine || null
  };
};

export const getWorkoutRecommendations = async (userProfile) => {
  const profile = normalizeProfile(userProfile);

  const messages = [
    {
      role: 'system',
      content: 'You are an expert fitness coach. Return only valid JSON matching the requested schema. Do not include markdown or prose.'
    },
    {
      role: 'user',
      content: `Create a workout plan JSON object.

Profile:
- Name: ${profile.name}
- Age: ${profile.age}
- Gender: ${profile.gender}
- Height: ${profile.height} cm
- Weight: ${profile.weight} kg
- Goal: ${profile.fitnessGoal}
- Activity level: ${profile.activityLevel}
- Medical conditions: ${profile.medicalConditions}
- Injuries: ${profile.injuries.join(', ') || 'none'}
- Duration: ${profile.duration} weeks
- Training frequency: ${getTrainingFrequency(profile.activityLevel)}

Schema:
{
  "durationWeeks": ${profile.duration},
  "weeklyPlan": {
    "frequency": "${getTrainingFrequency(profile.activityLevel)}",
    "restDays": "short recovery guidance"
  },
  "weeklySchedule": [
    {
      "week": 1,
      "focus": "Foundation",
      "days": [
        {
          "day": 1,
          "dayName": "Monday",
          "focus": "Upper Body",
          "exercises": [
            { "name": "Push-up", "sets": 3, "reps": "8-12", "restSeconds": 60, "notes": "form cue" }
          ]
        }
      ]
    }
  ],
  "recommendations": ["short practical tip"]
}

Rules:
- Return exactly ${profile.duration} week objects in weeklySchedule.
- Each week should contain 3 to 5 training days based on the requested frequency.
- Progress difficulty gently across weeks.
- Avoid exercises that conflict with medical conditions or injuries.`
    }
  ];

  try {
    const response = await makeAICall(messages, 0.25, 4096);
    const parsed = parseJsonObject(response);
    if (!parsed) throw new Error('Workout response was not valid JSON');
    return normalizeWorkoutPlan(parsed, profile, 'ai');
  } catch (error) {
    console.error('[AI] Workout generation fallback:', error?.message || error);
    return normalizeWorkoutPlan({}, profile, 'fallback');
  }
};

export const getMealPlanRecommendations = async (userProfile) => {
  const profile = normalizeProfile(userProfile);
  const dailyTargets = calculateDailyTargets(profile);
  const regionalContext = profile.state && profile.location
    ? `${profile.state}, ${profile.location}`
    : profile.location || profile.cuisine || 'International';

  const messages = [
    {
      role: 'system',
      content: 'You are a certified nutritionist. Return only valid JSON matching the requested schema. Do not include markdown or prose.'
    },
    {
      role: 'user',
      content: `Create a nutrition plan JSON object.

Profile:
- Name: ${profile.name}
- Age: ${profile.age}
- Gender: ${profile.gender}
- Height: ${profile.height} cm
- Weight: ${profile.weight} kg
- Goal: ${profile.fitnessGoal}
- Activity level: ${profile.activityLevel}
- Diet preference: ${profile.dietPreference}
- Medical conditions: ${profile.medicalConditions}
- Region/cuisine context: ${regionalContext}
- Duration: ${profile.duration} weeks

Daily targets:
- Calories: ${dailyTargets.calories}
- Protein: ${dailyTargets.protein}g
- Carbs: ${dailyTargets.carbs}g
- Fat: ${dailyTargets.fat}g
- Fiber: ${dailyTargets.fiber}g

Schema:
{
  "durationWeeks": ${profile.duration},
  "region": "${regionalContext}",
  "dailyTargets": {
    "calories": ${dailyTargets.calories},
    "protein": ${dailyTargets.protein},
    "carbs": ${dailyTargets.carbs},
    "fat": ${dailyTargets.fat},
    "fiber": ${dailyTargets.fiber}
  },
  "weeklyPlan": [
    {
      "day": 1,
      "dayName": "Monday",
      "meals": [
        {
          "mealType": "Breakfast",
          "name": "regional dish name",
          "calories": 400,
          "protein": 20,
          "carbs": 45,
          "fat": 15,
          "prepTime": "20 minutes",
          "foods": [
            { "name": "ingredient", "quantity": "1 cup", "calories": 150, "protein": 5, "carbs": 27, "fat": 3 }
          ],
          "recipeNotes": "brief cooking instruction"
        }
      ]
    }
  ],
  "tips": ["short practical nutrition tip"],
  "shoppingList": ["ingredient"]
}

Rules:
- Return exactly 7 day objects in weeklyPlan.
- Each day should contain 4 meals.
- Meals must respect diet preference and medical conditions.
- Prefer foods available in the region/cuisine context.`
    }
  ];

  try {
    const response = await makeAICall(messages, 0.25, 4096);
    const parsed = parseJsonObject(response);
    if (!parsed) throw new Error('Meal response was not valid JSON');
    return normalizeDietPlan(parsed, profile, 'ai');
  } catch (error) {
    console.error('[AI] Meal generation fallback:', error?.message || error);
    return normalizeDietPlan({}, profile, 'fallback');
  }
};

export const getFitnessCoachAdvice = async (question, userContext = {}) => {
  const messages = [
    {
      role: 'system',
      content: 'You are a concise fitness coach. Return JSON with an advice string and a short list of actionItems.'
    },
    {
      role: 'user',
      content: JSON.stringify({ question, userContext })
    }
  ];

  try {
    const response = await makeAICall(messages, 0.5, 1024);
    const parsed = parseJsonObject(response);
    return {
      advice: parsed?.advice || response || 'Service unavailable.',
      actionItems: Array.isArray(parsed?.actionItems) ? parsed.actionItems : [],
      timestamp: new Date().toISOString()
    };
  } catch {
    return {
      advice: 'Service unavailable.',
      actionItems: [],
      timestamp: new Date().toISOString()
    };
  }
};

export const analyzeProgress = async (progressData = {}) => {
  const messages = [
    {
      role: 'system',
      content: 'You analyze fitness progress. Return JSON with summary, trends, risks, and nextActions arrays.'
    },
    {
      role: 'user',
      content: JSON.stringify(progressData)
    }
  ];

  try {
    const response = await makeAICall(messages, 0.3, 1500);
    const parsed = parseJsonObject(response);
    return parsed || {
      summary: 'Progress data received.',
      trends: [],
      risks: [],
      nextActions: []
    };
  } catch {
    return {
      summary: 'Progress analysis is temporarily unavailable.',
      trends: [],
      risks: [],
      nextActions: []
    };
  }
};

export const analyzeExerciseForm = async (exerciseName, userFeedback = '') => {
  const messages = [
    {
      role: 'system',
      content: 'You give safe exercise form guidance. Return JSON with guidance, commonMistakes, and safetyCues arrays.'
    },
    {
      role: 'user',
      content: JSON.stringify({ exerciseName, userFeedback })
    }
  ];

  try {
    const response = await makeAICall(messages, 0.3, 1200);
    const parsed = parseJsonObject(response);
    return parsed || {
      guidance: `Focus on controlled form for ${exerciseName}.`,
      commonMistakes: [],
      safetyCues: ['Stop if you feel sharp pain.']
    };
  } catch {
    return {
      guidance: `Form guidance for ${exerciseName} is temporarily unavailable.`,
      commonMistakes: [],
      safetyCues: ['Stop if you feel sharp pain.']
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
