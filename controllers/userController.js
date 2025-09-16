import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
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
      password: hashedPassword
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
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email
    }
  });


}

export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const user = await prisma.user.findUnique({ where: { email } });
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
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      height: user.height,
      weight: user.weight,
      age: user.age,
      gender: user.gender,
      fitnessGoal: user.fitnessGoal,
      dietPreference: user.dietPreference,
      activityLevel: user.activityLevel,
      medicalConditions: user.medicalConditions,
      profileImages: user.profileImages
    }
  });

}

// Debug endpoint to list users (remove in production)
export const debugUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    });
    res.json({ users, count: users.length });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Validate token endpoint
export const validateToken = async (req, res) => {
  try {
    // If we reach here, the token is valid (middleware passed)
    res.json({ 
      valid: true, 
      user: req.user,
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
    // req.user is set by authenticateToken middleware
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        height: true,
        weight: true,
        age: true,
        gender: true,
        fitnessGoal: true,
        dietPreference: true,
        activityLevel: true,
        medicalConditions: true,
        profileImages: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ user });
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
      medicalConditions 
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Prepare update data - only include fields that are provided
    const updateData = { name };
    
    if (height !== undefined) updateData.height = parseFloat(height) || null;
    if (weight !== undefined) updateData.weight = parseFloat(weight) || null;
    if (age !== undefined) updateData.age = parseInt(age) || null;
    if (gender !== undefined) updateData.gender = gender || null;
    if (fitnessGoal !== undefined) updateData.fitnessGoal = fitnessGoal || null;
    if (dietPreference !== undefined) updateData.dietPreference = dietPreference || null;
    if (activityLevel !== undefined) updateData.activityLevel = activityLevel || null;
    if (medicalConditions !== undefined) updateData.medicalConditions = medicalConditions || null;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        height: true,
        weight: true,
        age: true,
        gender: true,
        fitnessGoal: true,
        dietPreference: true,
        activityLevel: true,
        medicalConditions: true,
        profileImages: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.status(200).json({ 
      message: 'Profile updated successfully',
      user: updatedUser 
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