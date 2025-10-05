import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Helper to shape user response to match previous API (flatten profile fields and images)
function toUserResponse(u) {
  const profile = u.profile || {};
  const images = (u.images || []).map(i => i.imageUrl);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    height: profile.height ?? null,
    weight: profile.weight ?? null,
    age: profile.age ?? null,
    gender: profile.gender ?? null,
    fitnessGoal: profile.fitnessGoal ?? null,
    dietPreference: profile.dietPreference ?? null,
    activityLevel: profile.activityLevel ?? null,
    medicalConditions: profile.medicalConditions ?? null,
    planDuration: profile.planDuration ?? null,
    profileImages: images
  };
}

export const signUp = async (req, res) => {
  const { name, email, password } = req.body;
  // Add your user creation logic here
  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    return res.status(400).json({ error: "User already exists" });
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      // Create an empty profile to simplify later updates
      profile: {
        create: {}
      }
    },
    include: {
      profile: true,
      images: true
    }
  });

  const token = jwt.sign(
    { userId: newUser.id, email: newUser.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  res.status(201).json({
    message: 'User created successfully',
    token,
    user: toUserResponse(newUser)
  });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const user = await prisma.user.findUnique({ 
    where: { email },
    include: { profile: true, images: true }
  });
  if (!user) {
    return res.status(400).json({ error: "User does not exist" });
  }
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ error: "Invalid credentials" });
  }
  
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
  
  // Return complete user profile data
  return res.status(200).json({ 
    message: "Login successful", 
    token,
    user: toUserResponse(user)
  });
};



// Validate token endpoint
export const validateToken = async (req, res) => {
  try {
    // If we reach here, the token is valid (middleware passed)
    res.json({ 
      valid: true, 
      user: { id: req.user.id, name: req.user.name, email: req.user.email },
      message: 'Token is valid' 
    });
  } catch (error) {
    res.status(401).json({ 
      valid: false, 
      error: 'Invalid token' 
    });
  }
};

// Get user profile (protected route)
export const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        profile: true,
        images: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ user: toUserResponse(user) });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
};

// Update user profile (protected route)
export const updateProfile = async (req, res) => {
  try {
    const { 
      name, 
      height, 
      weight, 
      age, 
      gender, 
      fitnessGoal, 
      dietPreference, 
      activityLevel, 
      medicalConditions,
      planDuration 
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Upsert profile data and update user name
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name,
        profile: {
          upsert: {
            create: {
              height: height !== undefined ? (parseFloat(height) || null) : undefined,
              weight: weight !== undefined ? (parseFloat(weight) || null) : undefined,
              age: age !== undefined ? (parseInt(age) || null) : undefined,
              gender: gender ?? undefined,
              fitnessGoal: fitnessGoal ?? undefined,
              dietPreference: dietPreference ?? undefined,
              activityLevel: activityLevel ?? undefined,
              medicalConditions: medicalConditions ?? undefined,
              planDuration: planDuration !== undefined ? (parseInt(planDuration) || null) : undefined
            },
            update: {
              height: height !== undefined ? (parseFloat(height) || null) : undefined,
              weight: weight !== undefined ? (parseFloat(weight) || null) : undefined,
              age: age !== undefined ? (parseInt(age) || null) : undefined,
              gender: gender ?? undefined,
              fitnessGoal: fitnessGoal ?? undefined,
              dietPreference: dietPreference ?? undefined,
              activityLevel: activityLevel ?? undefined,
              medicalConditions: medicalConditions ?? undefined,
              planDuration: planDuration !== undefined ? (parseInt(planDuration) || null) : undefined
            }
          }
        }
      },
      include: {
        profile: true,
        images: true
      }
    });

    res.status(200).json({ 
      message: 'Profile updated successfully',
      user: toUserResponse(updated)
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// Logout (optional - mainly for token blacklisting if implemented)
export const logout = async (req, res) => {
  try {
    // In a stateless JWT system, logout is mainly client-side
    // You could implement token blacklisting here if needed
    res.status(200).json({ 
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
};