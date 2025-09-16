import express from 'express';
import { upload } from '../utils/cloudinary.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const imageRoutes = express.Router();

// Upload profile images (up to 3 files: front, side, back)
imageRoutes.post('/upload-profile-images', 
  authenticateToken,
  upload.array('images', 3), // Allow up to 3 images
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No images uploaded' 
        });
      }

      // Extract image URLs from uploaded files
      const imageUrls = req.files.map(file => file.path);
      
      // Update user's profile images in database
      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: { profileImages: imageUrls },
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

      res.json({
        success: true,
        message: 'Profile images uploaded successfully',
        user: updatedUser,
        imageUrls: imageUrls
      });

    } catch (error) {
      console.error('Image upload error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to upload images',
        error: error.message 
      });
    }
  }
);

// Delete profile images
imageRoutes.delete('/profile-images', 
  authenticateToken,
  async (req, res) => {
    try {
      // Update user to remove profile images
      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: { profileImages: [] },
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

      res.json({
        success: true,
        message: 'Profile images deleted successfully',
        user: updatedUser
      });

    } catch (error) {
      console.error('Image deletion error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to delete images',
        error: error.message 
      });
    }
  }
);

export default imageRoutes;