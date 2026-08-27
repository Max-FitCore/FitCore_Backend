const Session = require('../models/Session');
const User = require('../models/User');

// @desc    Create a new session
// @route   POST /api/sessions/create
// @access  Private (Trainer only)
const createSession = async (req, res) => {
  try {
    const {
      day,
      time,
      sessionName,
      difficulty,
      description,
      maxParticipants,
      duration,
      location
    } = req.body;

    const trainerId = req.user._id;

    // Check if user is a trainer
    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Only trainers can create sessions'
      });
    }

    // Validate required fields
    if (!day || !time || !sessionName || !difficulty) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: day, time, sessionName, difficulty'
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
        message: `You already have a session on ${day} at ${time}`
      });
    }

    // Create session
    const session = await Session.create({
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

    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      data: session
    });

  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating session',
      error: error.message
    });
  }
};

// @desc    Get all sessions (trainer's own)
// @route   GET /api/sessions/my-sessions
// @access  Private (Trainer only)
const getMySessions = async (req, res) => {
  try {
    const trainerId = req.user._id;

    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Only trainers can view their sessions'
      });
    }

    const sessions = await Session.find({ trainerId })
      .sort({ day: 1, time: 1 });

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sessions',
      error: error.message
    });
  }
};

// @desc    Get a single session
// @route   GET /api/sessions/:id
// @access  Private
const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await Session.findById(id)
      .populate('trainerId', 'fullName email')
      .populate('bookedMembers', 'fullName email');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check access: trainer owns it or member is booked
    if (req.user.role === 'trainer' && session.trainerId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this session'
      });
    }

    if (req.user.role === 'member') {
      const isBooked = session.bookedMembers.some(
        member => member._id.toString() === req.user._id.toString()
      );
      if (!isBooked) {
        return res.status(403).json({
          success: false,
          message: 'You are not booked for this session'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: session
    });

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching session',
      error: error.message
    });
  }
};

// @desc    Update a session
// @route   PUT /api/sessions/:id
// @access  Private (Trainer only)
const updateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const trainerId = req.user._id;

    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Only trainers can update sessions'
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if trainer owns this session
    if (session.trainerId.toString() !== trainerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own sessions'
      });
    }

    const updateData = req.body;

    // If changing day/time, check for conflicts
    if (updateData.day || updateData.time) {
      const newDay = updateData.day || session.day;
      const newTime = updateData.time || session.time;

      const conflict = await Session.findOne({
        _id: { $ne: id },
        trainerId,
        day: newDay,
        time: newTime,
        isActive: true
      });

      if (conflict) {
        return res.status(400).json({
          success: false,
          message: `You already have a session on ${newDay} at ${newTime}`
        });
      }
    }

    const updatedSession = await Session.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Session updated successfully',
      data: updatedSession
    });

  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating session',
      error: error.message
    });
  }
};

// @desc    Delete a session
// @route   DELETE /api/sessions/:id
// @access  Private (Trainer only)
const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;
    const trainerId = req.user._id;

    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Only trainers can delete sessions'
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.trainerId.toString() !== trainerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own sessions'
      });
    }

    // Soft delete
    session.isActive = false;
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting session',
      error: error.message
    });
  }
};

// @desc    Book a session (member)
// @route   POST /api/sessions/:id/book
// @access  Private (Member only)
const bookSession = async (req, res) => {
  try {
    const { id } = req.params;
    const memberId = req.user._id;

    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can book sessions'
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (!session.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This session is no longer available'
      });
    }

    if (session.isFull) {
      return res.status(400).json({
        success: false,
        message: 'This session is fully booked'
      });
    }

    // Check if already booked
    if (session.bookedMembers.includes(memberId)) {
      return res.status(400).json({
        success: false,
        message: 'You are already booked for this session'
      });
    }

    // Add member to booked list
    session.bookedMembers.push(memberId);
    session.currentParticipants += 1;
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Session booked successfully',
      data: {
        sessionId: session._id,
        sessionName: session.sessionName,
        day: session.day,
        time: session.time,
        availableSpots: session.maxParticipants - session.currentParticipants
      }
    });

  } catch (error) {
    console.error('Book session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error booking session',
      error: error.message
    });
  }
};

// @desc    Cancel booking (member)
// @route   DELETE /api/sessions/:id/cancel
// @access  Private (Member only)
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const memberId = req.user._id;

    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can cancel bookings'
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if member is booked
    if (!session.bookedMembers.includes(memberId)) {
      return res.status(400).json({
        success: false,
        message: 'You are not booked for this session'
      });
    }

    // Remove member from booked list
    session.bookedMembers = session.bookedMembers.filter(
      id => id.toString() !== memberId.toString()
    );
    session.currentParticipants -= 1;
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        sessionId: session._id,
        sessionName: session.sessionName,
        availableSpots: session.maxParticipants - session.currentParticipants
      }
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling booking',
      error: error.message
    });
  }
};

// @desc    Get all available sessions (for members)
// @route   GET /api/sessions/available
// @access  Private (Member only)
const getAvailableSessions = async (req, res) => {
  try {
    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can view available sessions'
      });
    }

    const sessions = await Session.find({
      isActive: true,
      isFull: false
    })
    .populate('trainerId', 'fullName email')
    .sort({ day: 1, time: 1 });

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions
    });

  } catch (error) {
    console.error('Get available sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available sessions',
      error: error.message
    });
  }
};

// @desc    Get my booked sessions (member)
// @route   GET /api/sessions/my-bookings
// @access  Private (Member only)
const getMyBookings = async (req, res) => {
  try {
    const memberId = req.user._id;

    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can view their bookings'
      });
    }

    const sessions = await Session.find({
      bookedMembers: memberId,
      isActive: true
    })
    .populate('trainerId', 'fullName email')
    .sort({ day: 1, time: 1 });

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions
    });

  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your bookings',
      error: error.message
    });
  }
};

// @desc    Get session participants (trainer)
// @route   GET /api/sessions/:id/participants
// @access  Private (Trainer only)
const getSessionParticipants = async (req, res) => {
  try {
    const { id } = req.params;
    const trainerId = req.user._id;

    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Only trainers can view participants'
      });
    }

    const session = await Session.findOne({
      _id: id,
      trainerId: trainerId
    }).populate('bookedMembers', 'fullName email phone location');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or you do not own it'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        session: {
          _id: session._id,
          sessionName: session.sessionName,
          day: session.day,
          time: session.time
        },
        totalParticipants: session.currentParticipants,
        maxParticipants: session.maxParticipants,
        availableSpots: session.availableSpots,
        participants: session.bookedMembers
      }
    });

  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching participants',
      error: error.message
    });
  }
};

module.exports = {
  createSession,
  getMySessions,
  getSessionById,
  updateSession,
  deleteSession,
  bookSession,
  cancelBooking,
  getAvailableSessions,
  getMyBookings,
  getSessionParticipants
};