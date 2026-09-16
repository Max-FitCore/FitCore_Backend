const User = require('../models/User');

// @desc    Get all members (public - no auth required)
// @route   GET /api/public/members
// @access  Public
const getAllMembersPublic = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;

    // Build query
    const query = { 
      role: 'member', 
      isActive: true 
    };

    // Add search filter if provided
    if (search && search.trim()) {
      query.$or = [
        { fullName: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(query);

    // Fetch members (only public fields)
    const members = await User.find(query)
      .select('fullName email profilePicture location bio createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: members.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: members
    });

  } catch (error) {
    console.error('Get all members public error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching members',
      error: error.message
    });
  }
};

// @desc    Get a single member by ID (public - no auth required)
// @route   GET /api/public/members/:id
// @access  Public
const getMemberByIdPublic = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await User.findOne({
      _id: id,
      role: 'member',
      isActive: true
    }).select('fullName email profilePicture location bio createdAt');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.status(200).json({
      success: true,
      data: member
    });

  } catch (error) {
    console.error('Get member by ID public error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching member',
      error: error.message
    });
  }
};

// @desc    Get all trainers (public - no auth required)
// @route   GET /api/public/trainers
// @access  Public
const getAllTrainersPublic = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', speciality = '' } = req.query;

    // Build query
    const query = { 
      role: 'trainer', 
      isActive: true 
    };

    // Add search filter if provided
    if (search && search.trim()) {
      query.$or = [
        { fullName: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
        { speciality: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Add speciality filter if provided
    if (speciality && speciality.trim()) {
      query.speciality = { $regex: speciality.trim(), $options: 'i' };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(query);

    // Fetch trainers (only public fields)
    const trainers = await User.find(query)
      .select('fullName email profilePicture location bio speciality certifications availability createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: trainers.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: trainers
    });

  } catch (error) {
    console.error('Get all trainers public error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trainers',
      error: error.message
    });
  }
};

// @desc    Get a single trainer by ID (public - no auth required)
// @route   GET /api/public/trainers/:id
// @access  Public
const getTrainerByIdPublic = async (req, res) => {
  try {
    const { id } = req.params;

    const trainer = await User.findOne({
      _id: id,
      role: 'trainer',
      isActive: true
    }).select('fullName email profilePicture location bio speciality certifications availability createdAt');

    if (!trainer) {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }

    res.status(200).json({
      success: true,
      data: trainer
    });

  } catch (error) {
    console.error('Get trainer by ID public error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trainer',
      error: error.message
    });
  }
};

// @desc    Get gym info (public - no auth required)
// @route   GET /api/public/gym-info
// @access  Public
const getGymInfo = async (req, res) => {
  try {
    const admin = await User.findOne({ 
      role: 'administrator',
      isActive: true 
    }).select('gymName address openingHours about fullName email phone location');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Gym information not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        gymName: admin.gymName,
        address: admin.address,
        openingHours: admin.openingHours,
        about: admin.about,
        contact: {
          email: admin.email,
          phone: admin.phone,
          location: admin.location
        }
      }
    });

  } catch (error) {
    console.error('Get gym info error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching gym information',
      error: error.message
    });
  }
};

module.exports = {
  getAllMembersPublic,
  getMemberByIdPublic,
  getAllTrainersPublic,
  getTrainerByIdPublic,
  getGymInfo
};