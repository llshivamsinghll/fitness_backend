export const PLAN_SCHEMA_VERSION = 3;

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  'very-active': 1.9
};

const GOAL_CALORIE_ADJUSTMENTS = {
  'fat-loss': -400,
  'muscle-gain': 300,
  maintenance: 0,
  'general-fitness': 0
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clampInt(value, fallback, min, max) {
  const n = Math.trunc(toNumber(value, fallback));
  return Math.min(max, Math.max(min, n));
}

export function normalizeDurationWeeks(value) {
  return clampInt(value, 8, 1, 16);
}

export function normalizeActivityLevel(value) {
  return ACTIVITY_MULTIPLIERS[value] ? value : 'moderate';
}

export function normalizeFitnessGoal(value) {
  return GOAL_CALORIE_ADJUSTMENTS[value] !== undefined ? value : 'general-fitness';
}

export function getTrainingFrequency(activityLevel) {
  const level = normalizeActivityLevel(activityLevel);
  if (level === 'very-active') return '5-6/week';
  if (level === 'active') return '4-5/week';
  if (level === 'light') return '2-3/week';
  if (level === 'sedentary') return '2-3/week';
  return '3-4/week';
}

export function calculateDailyTargets(profile) {
  const age = clampInt(profile.age, 25, 12, 100);
  const weight = toNumber(profile.weight, 70);
  const height = toNumber(profile.height, 170);
  const activityLevel = normalizeActivityLevel(profile.activityLevel);
  const fitnessGoal = normalizeFitnessGoal(profile.fitnessGoal);

  const bmr = profile.gender === 'male'
    ? 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
    : 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);

  const calories = Math.max(1200, Math.round(
    (bmr * ACTIVITY_MULTIPLIERS[activityLevel]) + GOAL_CALORIE_ADJUSTMENTS[fitnessGoal]
  ));

  return {
    calories,
    protein: Math.round(weight * (fitnessGoal === 'muscle-gain' ? 2 : 1.7)),
    carbs: Math.round((calories * 0.45) / 4),
    fat: Math.round((calories * 0.25) / 9),
    fiber: 25
  };
}

function normalizeExercise(exercise = {}, index = 0) {
  return {
    id: clampInt(exercise.id, index + 1, 1, 999),
    name: String(exercise.name || 'Bodyweight Squat').trim(),
    sets: clampInt(exercise.sets, 3, 1, 10),
    reps: String(exercise.reps || '8-12').trim(),
    restSeconds: clampInt(exercise.restSeconds ?? exercise.rest, 60, 15, 300),
    notes: String(exercise.notes || 'Use controlled form and stop if pain appears.').trim()
  };
}

function normalizeWorkoutDay(day = {}, index = 0) {
  const exercises = Array.isArray(day.exercises) ? day.exercises : [];
  return {
    day: clampInt(day.day, index + 1, 1, 7),
    dayName: String(day.dayName || WEEKDAYS[index] || `Day ${index + 1}`).trim(),
    focus: String(day.focus || 'Full Body').trim(),
    exercises: exercises.length > 0
      ? exercises.map(normalizeExercise)
      : [
          normalizeExercise({ name: 'Bodyweight Squat', sets: 3, reps: '10-15', restSeconds: 60 }, 0),
          normalizeExercise({ name: 'Push-up', sets: 3, reps: '6-12', restSeconds: 60 }, 1),
          normalizeExercise({ name: 'Plank', sets: 3, reps: '30-45 sec', restSeconds: 45 }, 2)
        ]
  };
}

function fallbackWorkoutDays(activityLevel) {
  const frequency = getTrainingFrequency(activityLevel).startsWith('2') ? 3 : 4;
  const baseDays = [
    { dayName: 'Monday', focus: 'Upper Body', exercises: [
      { name: 'Push-up', sets: 3, reps: '8-12', restSeconds: 60 },
      { name: 'Dumbbell Row', sets: 3, reps: '10-12', restSeconds: 75 },
      { name: 'Shoulder Press', sets: 3, reps: '8-10', restSeconds: 75 }
    ] },
    { dayName: 'Wednesday', focus: 'Lower Body', exercises: [
      { name: 'Squat', sets: 3, reps: '10-15', restSeconds: 75 },
      { name: 'Reverse Lunge', sets: 3, reps: '8-12 each leg', restSeconds: 75 },
      { name: 'Glute Bridge', sets: 3, reps: '12-15', restSeconds: 60 }
    ] },
    { dayName: 'Friday', focus: 'Core and Conditioning', exercises: [
      { name: 'Plank', sets: 3, reps: '30-60 sec', restSeconds: 60 },
      { name: 'Mountain Climber', sets: 3, reps: '20-30', restSeconds: 60 },
      { name: 'Brisk Walk', sets: 1, reps: '20-30 min', restSeconds: 0 }
    ] },
    { dayName: 'Saturday', focus: 'Full Body', exercises: [
      { name: 'Goblet Squat', sets: 3, reps: '10-12', restSeconds: 75 },
      { name: 'Incline Push-up', sets: 3, reps: '8-12', restSeconds: 60 },
      { name: 'Dead Bug', sets: 3, reps: '10 each side', restSeconds: 45 }
    ] }
  ];

  return baseDays.slice(0, frequency).map(normalizeWorkoutDay);
}

export function normalizeWorkoutPlan(plan = {}, profile = {}, source = 'ai') {
  const durationWeeks = normalizeDurationWeeks(plan.durationWeeks ?? profile.duration);
  const weeklySchedule = Array.isArray(plan.weeklySchedule) && plan.weeklySchedule.length > 0
    ? plan.weeklySchedule
    : [];

  const weeks = Array.from({ length: durationWeeks }, (_, index) => {
    const week = weeklySchedule[index] || {};
    const days = Array.isArray(week.days) && week.days.length > 0
      ? week.days
      : fallbackWorkoutDays(profile.activityLevel);

    return {
      week: index + 1,
      focus: String(week.focus || (index < Math.ceil(durationWeeks / 2) ? 'Foundation' : 'Progression')).trim(),
      days: days.map(normalizeWorkoutDay)
    };
  });

  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    source,
    durationWeeks,
    weeklyPlan: {
      frequency: plan.weeklyPlan?.frequency || getTrainingFrequency(profile.activityLevel),
      restDays: plan.weeklyPlan?.restDays || 'Use non-training days for recovery, mobility, or light walking.'
    },
    weeklySchedule: weeks,
    recommendations: Array.isArray(plan.recommendations)
      ? plan.recommendations
      : ['Warm up before training.', 'Use controlled form.', 'Progress gradually week to week.'],
    generatedAt: new Date().toISOString()
  };
}

function normalizeFood(food = {}) {
  return {
    name: String(food.name || 'Ingredient').trim(),
    quantity: String(food.quantity || '1 serving').trim(),
    calories: clampInt(food.calories, 0, 0, 2000),
    protein: toNumber(food.protein, 0),
    carbs: toNumber(food.carbs, 0),
    fat: toNumber(food.fat, 0)
  };
}

function normalizeMeal(meal = {}, index = 0) {
  const foods = Array.isArray(meal.foods) ? meal.foods.map(normalizeFood) : [];
  const foodCalories = foods.reduce((sum, food) => sum + food.calories, 0);
  const calories = clampInt(meal.calories, foodCalories || 400, 100, 2000);

  return {
    mealType: String(meal.mealType || ['Breakfast', 'Lunch', 'Snack', 'Dinner'][index] || 'Meal').trim(),
    name: String(meal.name || 'Balanced meal').trim(),
    calories,
    protein: toNumber(meal.protein, 20),
    carbs: toNumber(meal.carbs, 45),
    fat: toNumber(meal.fat, 15),
    prepTime: String(meal.prepTime || '20-30 minutes').trim(),
    foods,
    recipeNotes: String(meal.recipeNotes || '').trim()
  };
}

function fallbackMeals(profile, targets) {
  const region = `${profile.state || ''} ${profile.location || ''} ${profile.cuisine || ''}`.toLowerCase();
  const vegetarian = ['vegetarian', 'vegan'].includes(profile.dietPreference);
  const india = region.includes('india') || region.includes('maharashtra') || region.includes('gujarat') || region.includes('punjab');

  const meals = india
    ? [
        { mealType: 'Breakfast', name: 'Poha with peanuts', protein: 12, carbs: 58, fat: 10 },
        { mealType: 'Lunch', name: vegetarian ? 'Dal, rice, and sabzi' : 'Chicken curry with rice and sabzi', protein: vegetarian ? 24 : 38, carbs: 78, fat: 16 },
        { mealType: 'Snack', name: 'Sprouts chaat', protein: 14, carbs: 28, fat: 6 },
        { mealType: 'Dinner', name: vegetarian ? 'Paneer bhurji with roti' : 'Fish curry with roti', protein: vegetarian ? 32 : 36, carbs: 48, fat: 18 }
      ]
    : [
        { mealType: 'Breakfast', name: 'Oats with milk and fruit', protein: 18, carbs: 50, fat: 10 },
        { mealType: 'Lunch', name: vegetarian ? 'Tofu rice bowl' : 'Grilled chicken rice bowl', protein: vegetarian ? 28 : 38, carbs: 64, fat: 14 },
        { mealType: 'Snack', name: 'Yogurt with nuts', protein: 15, carbs: 20, fat: 9 },
        { mealType: 'Dinner', name: vegetarian ? 'Lentil quinoa plate' : 'Fish with quinoa and vegetables', protein: vegetarian ? 30 : 36, carbs: 42, fat: 18 }
      ];

  const caloriesPerMeal = Math.round(targets.calories / meals.length);
  return meals.map((meal) => ({ ...meal, calories: caloriesPerMeal, foods: [] }));
}

export function normalizeDietPlan(plan = {}, profile = {}, source = 'ai') {
  const durationWeeks = normalizeDurationWeeks(plan.durationWeeks ?? profile.duration);
  const dailyTargets = {
    ...calculateDailyTargets(profile),
    ...(plan.dailyTargets || {})
  };

  const incomingWeeklyPlan = Array.isArray(plan.weeklyPlan)
    ? plan.weeklyPlan
    : [];

  const firstDayMeals = incomingWeeklyPlan[0]?.meals || plan.meals || fallbackMeals(profile, dailyTargets);
  const weeklyPlan = Array.from({ length: 7 }, (_, index) => {
    const day = incomingWeeklyPlan[index] || {};
    const meals = Array.isArray(day.meals) && day.meals.length > 0 ? day.meals : firstDayMeals;
    return {
      day: index + 1,
      dayName: day.dayName || WEEKDAYS[index],
      meals: meals.map(normalizeMeal)
    };
  });

  const meals = weeklyPlan[0].meals;

  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    source,
    durationWeeks,
    region: plan.region || profile.state || profile.location || profile.cuisine || 'International',
    dailyTargets,
    weeklyPlan,
    meals,
    tips: Array.isArray(plan.tips)
      ? plan.tips
      : ['Keep protein consistent across meals.', 'Hydrate well.', 'Adjust portions based on hunger and progress.'],
    shoppingList: Array.isArray(plan.shoppingList) ? plan.shoppingList : (Array.isArray(plan.shopping_list) ? plan.shopping_list : []),
    generatedAt: new Date().toISOString()
  };
}
