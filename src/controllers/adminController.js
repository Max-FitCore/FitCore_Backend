const User = require('../models/User');
const OTP = require('../models/OTP');
const Session = require('../models/Session');
const WorkoutPlan = require('../models/WorkoutPlan');
const bcrypt = require('bcryptjs');

// ============ TRAINER MANAGEMENT ============

// @desc    Get all trainers
// @route   GET /api/admin/trainers
// @access  Private (Admin only)
const getAllTrainers = async (req, res) => {
  try {
    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const trainers = await User.find({ role: 'trainer' })
      .select('-password')
      .sort({ createdAt: -1 });

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

    const sessions = await Session.find({ 
      trainerId: trainer._id,
      isActive: true 
    }).select('day time sessionName difficulty currentParticipants maxParticipants');

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

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and password are required'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const trainer = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role: 'trainer',
      isVerified: true,
      phone: phone || null,
      location: location || null,
      bio: bio || null,
      speciality: speciality || null,
      certifications: certifications || null,
      availability: availability || null
    });

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

    const trainerName = trainer.fullName;
    const trainerEmail = trainer.email;

    await OTP.deleteMany({ userId: trainer._id });
    const sessionResult = await Session.deleteMany({ trainerId: trainer._id });
    const planResult = await WorkoutPlan.deleteMany({ trainerId: trainer._id });
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

// ============ MEMBER MANAGEMENT ============

// @desc    Get all members
// @route   GET /api/admin/members
// @access  Private (Admin only)
const getAllMembers = async (req, res) => {
  try {
    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const members = await User.find({ role: 'member' })
      .select('-password')
      .sort({ createdAt: -1 });

    // Get additional stats for each member
    const membersWithStats = await Promise.all(
      members.map(async (member) => {
        // Count sessions booked by this member
        const bookedSessions = await Session.countDocuments({
          bookedMembers: member._id,
          isActive: true
        });

        // Count workout plans assigned to this member
        const assignedPlans = await WorkoutPlan.countDocuments({
          assignedMembers: member._id,
          isActive: true
        });

        return {
          ...member.toObject(),
          stats: {
            totalBookedSessions: bookedSessions,
            totalAssignedPlans: assignedPlans
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      count: membersWithStats.length,
      data: membersWithStats
    });

  } catch (error) {
    console.error('Get all members error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching members',
      error: error.message
    });
  }
};

// @desc    Get a single member by ID
// @route   GET /api/admin/members/:id
// @access  Private (Admin only)
const getMemberById = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const member = await User.findOne({ 
      _id: id, 
      role: 'member' 
    }).select('-password');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Get member's booked sessions
    const bookedSessions = await Session.find({
      bookedMembers: member._id,
      isActive: true
    })
    .populate('trainerId', 'fullName email')
    .select('day time sessionName difficulty');

    // Get member's assigned workout plans
    const assignedPlans = await WorkoutPlan.find({
      assignedMembers: member._id,
      isActive: true
    })
    .populate('trainerId', 'fullName email')
    .select('planName planType planLevel totalSessions');

    res.status(200).json({
      success: true,
      data: {
        member,
        stats: {
          totalBookedSessions: bookedSessions.length,
          totalAssignedPlans: assignedPlans.length
        },
        bookedSessions,
        assignedPlans
      }
    });

  } catch (error) {
    console.error('Get member by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching member',
      error: error.message
    });
  }
};

// @desc    Add a new member
// @route   POST /api/admin/members/add
// @access  Private (Admin only)
const addMember = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      phone,
      location,
      bio,
      dateOfBirth,
      gender,
      address,
      emergencyContact,
      medicalConditions,
      fitnessGoals
    } = req.body;

    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and password are required'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Build member details
    const memberDetails = {};
    if (dateOfBirth) memberDetails.dateOfBirth = dateOfBirth;
    if (gender) memberDetails.gender = gender;
    if (address) memberDetails.address = address;
    if (emergencyContact) memberDetails.emergencyContact = emergencyContact;
    if (medicalConditions) memberDetails.medicalConditions = medicalConditions;
    if (fitnessGoals) memberDetails.fitnessGoals = fitnessGoals;

    const member = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role: 'member',
      isVerified: true, // Admin-added members are pre-verified
      phone: phone || null,
      location: location || null,
      bio: bio || null,
      memberDetails: Object.keys(memberDetails).length > 0 ? memberDetails : undefined
    });

    member.password = undefined;

    res.status(201).json({
      success: true,
      message: 'Member added successfully',
      data: member
    });

  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding member',
      error: error.message
    });
  }
};

// @desc    Delete a member (permanently)
// @route   DELETE /api/admin/members/:id
// @access  Private (Admin only)
const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const member = await User.findOne({ 
      _id: id, 
      role: 'member' 
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const memberName = member.fullName;
    const memberEmail = member.email;

    // Delete all OTPs
    await OTP.deleteMany({ userId: member._id });

    // Remove member from all sessions
    await Session.updateMany(
      { bookedMembers: member._id },
      { $pull: { bookedMembers: member._id } }
    );

    // Remove member from all workout plans
    await WorkoutPlan.updateMany(
      { assignedMembers: member._id },
      { $pull: { assignedMembers: member._id } }
    );

    // Delete the member
    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: `Member "${memberName}" deleted successfully`,
      data: {
        member: {
          name: memberName,
          email: memberEmail
        }
      }
    });

  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting member',
      error: error.message
    });
  }
};

// @desc    Update a member (admin)
// @route   PUT /api/admin/members/:id
// @access  Private (Admin only)
const updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      phone,
      location,
      bio,
      isActive,
      dateOfBirth,
      gender,
      address,
      emergencyContact,
      medicalConditions,
      fitnessGoals
    } = req.body;

    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const member = await User.findOne({ 
      _id: id, 
      role: 'member' 
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

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

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    // Update member details
    const memberDetails = {};
    if (dateOfBirth !== undefined) memberDetails.dateOfBirth = dateOfBirth;
    if (gender !== undefined) memberDetails.gender = gender;
    if (address !== undefined) memberDetails.address = address;
    if (emergencyContact !== undefined) memberDetails.emergencyContact = emergencyContact;
    if (medicalConditions !== undefined) memberDetails.medicalConditions = medicalConditions;
    if (fitnessGoals !== undefined) memberDetails.fitnessGoals = fitnessGoals;

    if (Object.keys(memberDetails).length > 0) {
      updateData.memberDetails = {
        ...member.memberDetails,
        ...memberDetails
      };
    }

    const updatedMember = await User.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Member updated successfully',
      data: updatedMember
    });

  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating member',
      error: error.message
    });
  }
};

// ============ DASHBOARD ============

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
  // Trainer management
  getAllTrainers,
  getTrainerById,
  addTrainer,
  deleteTrainer,
  updateTrainer,
  // Member management
  getAllMembers,
  getMemberById,
  addMember,
  deleteMember,
  updateMember,
  // Dashboard
  getDashboardStats
};