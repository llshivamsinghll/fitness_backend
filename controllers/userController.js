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
  try {
    const { name, email, password } = req.body;
    
    console.log('[AUTH] Signup attempt:', { email, hasName: !!name, hasPassword: !!password });
    
    // Validation
    if (!name || !email || !password) {
      console.warn('[AUTH] Signup failed: Missing required fields');
      return res.status(400).json({ error: "All fields are required" });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.warn('[AUTH] Signup failed: Invalid email format');
      return res.status(400).json({ error: "Invalid email format" });
    }
    
    // Password strength validation
    if (password.length < 6) {
      console.warn('[AUTH] Signup failed: Password too short');
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      console.warn('[AUTH] Signup failed: User already exists for email:', email);
      return res.status(400).json({ error: "User already exists" });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        profile: {
          create: {}
        }
      },
      include: {
        profile: true,
        images: true
      }
    });

    // Generate token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    console.log('[AUTH] Signup successful for user:', email);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: toUserResponse(newUser)
    });
  } catch (error) {
    console.error('[ERROR] Signup error:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "Email already in use" });
    }
    
    res.status(500).json({ 
      error: "Registration failed. Please try again.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const login = async (req, res) => {
  try {
    console.log('[AUTH] Login attempt:', { 
      email: req.body?.email, 
      hasPassword: !!req.body?.password,
      timestamp: new Date().toISOString()
    });
    
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      console.warn('[AUTH] Login failed: Missing required fields');
      return res.status(400).json({ error: "Email and password are required" });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.warn('[AUTH] Login failed: Invalid email format');
      return res.status(400).json({ error: "Invalid email format" });
    }
    
    // Find user
    const user = await prisma.user.findUnique({ 
      where: { email: email.toLowerCase().trim() },
      include: { profile: true, images: true }
    });
    
    if (!user) {
      console.warn('[AUTH] Login failed: User not found for email:', email);
      // Use generic error message to prevent user enumeration
      return res.status(401).json({ error: "Invalid email or password" });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.warn('[AUTH] Login failed: Invalid password for email:', email);
      // Use generic error message to prevent user enumeration
      return res.status(401).json({ error: "Invalid email or password" });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    
    console.log('[AUTH] Login successful for user:', email);
    
    // Return complete user profile data
    return res.status(200).json({ 
      message: "Login successful", 
      token,
      user: toUserResponse(user)
    });
  } catch (error) {
    console.error('[ERROR] Login error:', error);
    console.error('  Error details:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    
    return res.status(500).json({ 
      error: "Login failed. Please try again.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
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
    console.log('[PROFILE] Profile update for user:', req.user.email);
    
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
      planDuration,
      location,
      cuisine
    } = req.body;
    
    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Validate numeric fields
    if (height !== undefined && height !== null) {
      const heightNum = parseFloat(height);
      if (isNaN(heightNum) || heightNum <= 0 || heightNum > 300) {
        return res.status(400).json({ error: 'Invalid height value' });
      }
    }
    
    if (weight !== undefined && weight !== null) {
      const weightNum = parseFloat(weight);
      if (isNaN(weightNum) || weightNum <= 0 || weightNum > 500) {
        return res.status(400).json({ error: 'Invalid weight value' });
      }
    }
    
    if (age !== undefined && age !== null) {
      const ageNum = parseInt(age);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
        return res.status(400).json({ error: 'Invalid age value' });
      }
    }

    // Upsert profile data and update user name
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name.trim(),
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
              planDuration: planDuration !== undefined ? (parseInt(planDuration) || null) : undefined,
              location: location ?? undefined,
              cuisine: cuisine ?? undefined
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
              planDuration: planDuration !== undefined ? (parseInt(planDuration) || null) : undefined,
              location: location ?? undefined,
              cuisine: cuisine ?? undefined
            }
          }
        }
      },
      include: {
        profile: true,
        images: true
      }
    });

    console.log('[PROFILE] Profile updated successfully for user:', req.user.email);

    res.status(200).json({ 
      message: 'Profile updated successfully',
      user: toUserResponse(updated)
    });
  } catch (error) {
    console.error('[ERROR] Update profile error:', error);
    res.status(500).json({ 
      error: 'Failed to update profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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