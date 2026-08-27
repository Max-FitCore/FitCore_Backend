const User = require('../models/User');
const OTP = require('../models/OTP');
const Session = require('../models/Session');
const WorkoutPlan = require('../models/WorkoutPlan');
const bcrypt = require('bcryptjs');

// @desc    Get all trainers
// @route   GET /api/admin/trainers
// @access  Private (Admin only)
const getAllTrainers = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const trainers = await User.find({ role: 'trainer' })
      .select('-password')
      .sort({ createdAt: -1 });

    // Get additional stats for each trainer
    const trainersWithStats = await Promise.all(
      trainers.map(async (trainer) => {
        const sessionCount = await Session.countDocuments({ 
          trainerId: trainer._id,
          isActive: true 
        });
        
        const workoutPlanCount = await WorkoutPlan.countDocuments({ 
          trainerId: trainer._id,
          isActive: true 
        });

        const totalBookings = await Session.countDocuments({
          trainerId: trainer._id,
          isActive: true,
          bookedMembers: { $exists: true, $ne: [] }
        });

        return {
          ...trainer.toObject(),
          stats: {
            totalSessions: sessionCount,
            totalWorkoutPlans: workoutPlanCount,
            totalBookings: totalBookings
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      count: trainersWithStats.length,
      data: trainersWithStats
    });

  } catch (error) {
    console.error('Get all trainers error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trainers',
      error: error.message
    });
  }
};

// @desc    Get a single trainer by ID
// @route   GET /api/admin/trainers/:id
// @access  Private (Admin only)
const getTrainerById = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const trainer = await User.findOne({ 
      _id: id, 
      role: 'trainer' 
    }).select('-password');

    if (!trainer) {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }

    // Get trainer's sessions
    const sessions = await Session.find({ 
      trainerId: trainer._id,
      isActive: true 
    }).select('day time sessionName difficulty currentParticipants maxParticipants');

    // Get trainer's workout plans
    const workoutPlans = await WorkoutPlan.find({ 
      trainerId: trainer._id,
      isActive: true 
    }).select('planName planType planLevel totalSessions');

    res.status(200).json({
      success: true,
      data: {
        trainer,
        stats: {
          totalSessions: sessions.length,
          totalWorkoutPlans: workoutPlans.length,
          totalParticipants: sessions.reduce((sum, s) => sum + s.currentParticipants, 0)
        },
        sessions,
        workoutPlans
      }
    });

  } catch (error) {
    console.error('Get trainer by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trainer',
      error: error.message
    });
  }
};

// @desc    Add a new trainer
// @route   POST /api/admin/trainers/add
// @access  Private (Admin only)
const addTrainer = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      phone,
      location,
      bio,
      speciality,
      certifications,
      availability
    } = req.body;

    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    // Validate required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create trainer
    const trainer = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role: 'trainer',
      isVerified: true, // Admin-added trainers are pre-verified
      phone: phone || null,
      location: location || null,
      bio: bio || null,
      speciality: speciality || null,
      certifications: certifications || null,
      availability: availability || null
    });

    // Remove password from response
    trainer.password = undefined;

    res.status(201).json({
      success: true,
      message: 'Trainer added successfully',
      data: trainer
    });

  } catch (error) {
    console.error('Add trainer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding trainer',
      error: error.message
    });
  }
};

// @desc    Delete a trainer (permanently)
// @route   DELETE /api/admin/trainers/:id
// @access  Private (Admin only)
const deleteTrainer = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    // Don't allow admin to delete themselves
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const trainer = await User.findOne({ 
      _id: id, 
      role: 'trainer' 
    });

    if (!trainer) {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }

    // Get trainer info before deletion
    const trainerName = trainer.fullName;
    const trainerEmail = trainer.email;

    // Delete all OTPs associated with this trainer
    await OTP.deleteMany({ userId: trainer._id });

    // Delete all sessions created by this trainer
    const sessionResult = await Session.deleteMany({ trainerId: trainer._id });

    // Delete all workout plans created by this trainer
    const planResult = await WorkoutPlan.deleteMany({ trainerId: trainer._id });

    // Delete the trainer
    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: `Trainer "${trainerName}" deleted successfully`,
      data: {
        trainer: {
          name: trainerName,
          email: trainerEmail
        },
        deleted: {
          sessions: sessionResult.deletedCount || 0,
          workoutPlans: planResult.deletedCount || 0
        }
      }
    });

  } catch (error) {
    console.error('Delete trainer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting trainer',
      error: error.message
    });
  }
};

// @desc    Update a trainer (admin)
// @route   PUT /api/admin/trainers/:id
// @access  Private (Admin only)
const updateTrainer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      phone,
      location,
      bio,
      speciality,
      certifications,
      availability,
      isActive
    } = req.body;

    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const trainer = await User.findOne({ 
      _id: id, 
      role: 'trainer' 
    });

    if (!trainer) {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }

    // Build update object
    const updateData = {};

    if (fullName !== undefined) {
      if (!fullName || !fullName.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Full name is required'
        });
      }
      if (fullName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Full name must be at least 2 characters'
        });
      }
      if (fullName.trim().length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Full name cannot exceed 50 characters'
        });
      }
      updateData.fullName = fullName.trim();
    }

    if (phone !== undefined) {
      updateData.phone = phone && phone.trim() ? phone.trim() : null;
    }

    if (location !== undefined) {
      updateData.location = location && location.trim() ? location.trim() : null;
    }

    if (bio !== undefined) {
      if (bio && bio.trim() && bio.trim().length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Bio cannot exceed 500 characters'
        });
      }
      updateData.bio = bio && bio.trim() ? bio.trim() : null;
    }

    if (speciality !== undefined) {
      if (speciality && speciality.trim() && speciality.trim().length > 200) {
        return res.status(400).json({
          success: false,
          message: 'Speciality cannot exceed 200 characters'
        });
      }
      updateData.speciality = speciality && speciality.trim() ? speciality.trim() : null;
    }

    if (certifications !== undefined) {
      if (certifications && certifications.trim() && certifications.trim().length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Certifications cannot exceed 500 characters'
        });
      }
      updateData.certifications = certifications && certifications.trim() ? certifications.trim() : null;
    }

    if (availability !== undefined) {
      if (availability && availability.trim() && availability.trim().length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Availability cannot exceed 500 characters'
        });
      }
      updateData.availability = availability && availability.trim() ? availability.trim() : null;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const updatedTrainer = await User.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Trainer updated successfully',
      data: updatedTrainer
    });

  } catch (error) {
    console.error('Update trainer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating trainer',
      error: error.message
    });
  }
};

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
const getDashboardStats = async (req, res) => {
  try {
    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const totalMembers = await User.countDocuments({ role: 'member', isActive: true });
    const totalTrainers = await User.countDocuments({ role: 'trainer', isActive: true });
    const totalSessions = await Session.countDocuments({ isActive: true });
    const totalWorkoutPlans = await WorkoutPlan.countDocuments({ isActive: true });
    const totalBookings = await Session.countDocuments({
      isActive: true,
      bookedMembers: { $exists: true, $ne: [] }
    });

    // Recent activity
    const recentTrainers = await User.find({ role: 'trainer' })
      .select('fullName email createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentMembers = await User.find({ role: 'member' })
      .select('fullName email createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    const upcomingSessions = await Session.find({ 
      isActive: true,
      isFull: { $ne: true }
    })
    .populate('trainerId', 'fullName')
    .sort({ createdAt: -1 })
    .limit(5);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalMembers,
          totalTrainers,
          totalSessions,
          totalWorkoutPlans,
          totalBookings
        },
        recent: {
          trainers: recentTrainers,
          members: recentMembers,
          upcomingSessions
        }
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard stats',
      error: error.message
    });
  }
};

module.exports = {
  getAllTrainers,
  getTrainerById,
  addTrainer,
  deleteTrainer,
  updateTrainer,
  getDashboardStats
};