import express from 'express';
import { upload } from '../utils/cloudinary.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const imageRoutes = express.Router();
// Uploads up to three profile photos and replaces any previously stored set.
imageRoutes.post('/upload-profile-images', 
  authenticateToken,
  upload.array('images', 3),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No images uploaded' 
        });
      }
      const imageUrls = req.files.map(file => file.path);
      // Keep one canonical image set by deleting old records before inserting new ones.
      await prisma.profileImage.deleteMany({ where: { userId: req.user.id } });
      await prisma.profileImage.createMany({
        data: imageUrls.map((url, idx) => ({
          userId: req.user.id,
          imageUrl: url,
          type: ['front','side','back'][idx] || 'other'
        }))
      });

      const updatedUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { profile: true, images: true }
      });

      // Return refreshed user payload so clients can update state without an extra fetch.
      res.json({
        success: true,
        message: 'Profile images uploaded successfully',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          height: updatedUser.profile?.height ?? null,
          weight: updatedUser.profile?.weight ?? null,
          age: updatedUser.profile?.age ?? null,
          gender: updatedUser.profile?.gender ?? null,
          fitnessGoal: updatedUser.profile?.fitnessGoal ?? null,
          dietPreference: updatedUser.profile?.dietPreference ?? null,
          activityLevel: updatedUser.profile?.activityLevel ?? null,
          medicalConditions: updatedUser.profile?.medicalConditions ?? null,
          profileImages: (updatedUser.images || []).map(i => i.imageUrl)
        },
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
// Deletes all stored profile photos for the authenticated user.
imageRoutes.delete('/profile-images', 
  authenticateToken,
  async (req, res) => {
    try {
      await prisma.profileImage.deleteMany({ where: { userId: req.user.id } });

      const updatedUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { profile: true, images: true }
      });

      res.json({
        success: true,
        message: 'Profile images deleted successfully',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          height: updatedUser.profile?.height ?? null,
          weight: updatedUser.profile?.weight ?? null,
          age: updatedUser.profile?.age ?? null,
          gender: updatedUser.profile?.gender ?? null,
          fitnessGoal: updatedUser.profile?.fitnessGoal ?? null,
          dietPreference: updatedUser.profile?.dietPreference ?? null,
          activityLevel: updatedUser.profile?.activityLevel ?? null,
          medicalConditions: updatedUser.profile?.medicalConditions ?? null,
          profileImages: (updatedUser.images || []).map(i => i.imageUrl)
        }
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