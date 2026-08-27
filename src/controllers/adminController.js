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

    const membersWithStats = await Promise.all(
      members.map(async (member) => {
        const bookedSessions = await Session.countDocuments({
          bookedMembers: member._id,
          isActive: true
        });

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

    const bookedSessions = await Session.find({
      bookedMembers: member._id,
      isActive: true
    })
    .populate('trainerId', 'fullName email')
    .select('day time sessionName difficulty');

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
      isVerified: true,
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

    await OTP.deleteMany({ userId: member._id });

    await Session.updateMany(
      { bookedMembers: member._id },
      { $pull: { bookedMembers: member._id } }
    );

    await WorkoutPlan.updateMany(
      { assignedMembers: member._id },
      { $pull: { assignedMembers: member._id } }
    );

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

// ============ CLASS (SESSION) MANAGEMENT ============

// @desc    Get all classes (sessions)
// @route   GET /api/admin/classes
// @access  Private (Admin only)
const getAllClasses = async (req, res) => {
  try {
    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const classes = await Session.find({ isActive: true })
      .populate('trainerId', 'fullName email')
      .populate('bookedMembers', 'fullName email')
      .sort({ day: 1, time: 1 });

    // Add additional stats
    const classesWithStats = classes.map(cls => ({
      ...cls.toObject(),
      availableSpots: cls.maxParticipants - cls.currentParticipants,
      participantCount: cls.bookedMembers.length
    }));

    res.status(200).json({
      success: true,
      count: classesWithStats.length,
      data: classesWithStats
    });

  } catch (error) {
    console.error('Get all classes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching classes',
      error: error.message
    });
  }
};

// @desc    Get a single class by ID
// @route   GET /api/admin/classes/:id
// @access  Private (Admin only)
const getClassById = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const classData = await Session.findOne({ 
      _id: id, 
      isActive: true 
    })
    .populate('trainerId', 'fullName email phone speciality')
    .populate('bookedMembers', 'fullName email phone location');

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...classData.toObject(),
        availableSpots: classData.maxParticipants - classData.currentParticipants
      }
    });

  } catch (error) {
    console.error('Get class by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching class',
      error: error.message
    });
  }
};

// @desc    Add a new class (admin)
// @route   POST /api/admin/classes/add
// @access  Private (Admin only)
const addClass = async (req, res) => {
  try {
    const {
      trainerId,
      day,
      time,
      sessionName,
      difficulty,
      description,
      maxParticipants,
      duration,
      location
    } = req.body;

    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    // Validate required fields
    if (!trainerId || !day || !time || !sessionName || !difficulty) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: trainerId, day, time, sessionName, difficulty'
      });
    }

    // Check if trainer exists and is a trainer
    const trainer = await User.findOne({
      _id: trainerId,
      role: 'trainer',
      isActive: true
    });

    if (!trainer) {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found or inactive'
      });
    }

    // Check for duplicate session (same trainer, same day, same time)
    const existingSession = await Session.findOne({
      trainerId,
      day,
      time,
      isActive: true
    });

    if (existingSession) {
      return res.status(400).json({
        success: false,
        message: `Trainer already has a class on ${day} at ${time}`
      });
    }

    // Create class
    const newClass = await Session.create({
      trainerId,
      day,
      time,
      sessionName,
      difficulty,
      description: description || null,
      maxParticipants: maxParticipants || 20,
      duration: duration || 60,
      location: location || 'Gym Main Floor'
    });

    // Populate trainer info for response
    await newClass.populate('trainerId', 'fullName email');

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: newClass
    });

  } catch (error) {
    console.error('Add class error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating class',
      error: error.message
    });
  }
};

// @desc    Update a class (admin)
// @route   PUT /api/admin/classes/:id
// @access  Private (Admin only)
const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      trainerId,
      day,
      time,
      sessionName,
      difficulty,
      description,
      maxParticipants,
      duration,
      location,
      isActive
    } = req.body;

    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const classData = await Session.findById(id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const updateData = {};

    // If trainerId is being updated, validate the new trainer
    if (trainerId) {
      const trainer = await User.findOne({
        _id: trainerId,
        role: 'trainer',
        isActive: true
      });

      if (!trainer) {
        return res.status(404).json({
          success: false,
          message: 'Trainer not found or inactive'
        });
      }
      updateData.trainerId = trainerId;
    }

    // If changing day/time, check for conflicts
    const newDay = day || classData.day;
    const newTime = time || classData.time;
    const newTrainerId = trainerId || classData.trainerId;

    if (day || time || trainerId) {
      const conflict = await Session.findOne({
        _id: { $ne: id },
        trainerId: newTrainerId,
        day: newDay,
        time: newTime,
        isActive: true
      });

      if (conflict) {
        return res.status(400).json({
          success: false,
          message: `Trainer already has a class on ${newDay} at ${newTime}`
        });
      }
    }

    if (day) updateData.day = day;
    if (time) updateData.time = time;
    if (sessionName) updateData.sessionName = sessionName;
    if (difficulty) updateData.difficulty = difficulty;
    if (description !== undefined) updateData.description = description || null;
    if (maxParticipants) updateData.maxParticipants = maxParticipants;
    if (duration) updateData.duration = duration;
    if (location) updateData.location = location;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedClass = await Session.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).populate('trainerId', 'fullName email');

    res.status(200).json({
      success: true,
      message: 'Class updated successfully',
      data: updatedClass
    });

  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating class',
      error: error.message
    });
  }
};

// @desc    Delete a class (admin)
// @route   DELETE /api/admin/classes/:id
// @access  Private (Admin only)
const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const classData = await Session.findById(id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const className = classData.sessionName;
    const classDay = classData.day;
    const classTime = classData.time;
    const participantCount = classData.bookedMembers.length;

    // Soft delete
    classData.isActive = false;
    await classData.save();

    res.status(200).json({
      success: true,
      message: `Class "${className}" deleted successfully`,
      data: {
        class: {
          name: className,
          day: classDay,
          time: classTime
        },
        participants: participantCount
      }
    });

  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting class',
      error: error.message
    });
  }
};

// @desc    Get class statistics (admin)
// @route   GET /api/admin/classes/stats/overview
// @access  Private (Admin only)
const getClassStats = async (req, res) => {
  try {
    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const totalClasses = await Session.countDocuments({ isActive: true });
    const totalBookings = await Session.aggregate([
      { $match: { isActive: true } },
      { $project: { participantCount: { $size: '$bookedMembers' } } },
      { $group: { _id: null, total: { $sum: '$participantCount' } } }
    ]);

    const averageParticipants = totalBookings.length > 0 
      ? Math.round(totalBookings[0].total / totalClasses) 
      : 0;

    // Classes by day
    const classesByDay = await Session.aggregate([
      { $match: { isActive: true } },
      { $group: { 
          _id: '$day', 
          count: { $sum: 1 },
          totalParticipants: { $sum: { $size: '$bookedMembers' } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Popular classes (most booked)
    const popularClasses = await Session.find({ isActive: true })
      .populate('trainerId', 'fullName')
      .select('sessionName day time bookedMembers')
      .sort({ bookedMembers: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalClasses,
          totalBookings: totalBookings.length > 0 ? totalBookings[0].total : 0,
          averageParticipants: averageParticipants || 0
        },
        byDay: classesByDay.map(day => ({
          day: day._id,
          count: day.count,
          totalParticipants: day.totalParticipants
        })),
        popularClasses: popularClasses.map(cls => ({
          _id: cls._id,
          sessionName: cls.sessionName,
          day: cls.day,
          time: cls.time,
          trainer: cls.trainerId.fullName,
          bookings: cls.bookedMembers.length
        }))
      }
    });

  } catch (error) {
    console.error('Class stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching class statistics',
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
  // Class management
  getAllClasses,
  getClassById,
  addClass,
  updateClass,
  deleteClass,
  getClassStats,
  // Dashboard
  getDashboardStats
};