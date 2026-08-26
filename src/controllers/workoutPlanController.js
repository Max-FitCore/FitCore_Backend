const WorkoutPlan = require('../models/WorkoutPlan');
const User = require('../models/User');

// @desc    Create a new workout plan
// @route   POST /api/workout-plans/create
// @access  Private (Trainer only)
const createWorkoutPlan = async (req, res) => {
  try {
    const {
      planName,
      planType,
      planLevel,
      totalSessions,
      sessionsPerWeek,
      description,
      planIcon,
      workoutDays
    } = req.body;

    const trainerId = req.user._id;

    // Check if user is a trainer
    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Only trainers can create workout plans'
      });
    }

    // Validate required fields
    if (!planName || !planType || !planLevel || !totalSessions || !sessionsPerWeek) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: planName, planType, planLevel, totalSessions, sessionsPerWeek'
      });
    }

    // Validate workoutDays
    if (!workoutDays || !Array.isArray(workoutDays) || workoutDays.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one workout day is required'
      });
    }

    // Validate each workout day
    for (const day of workoutDays) {
      if (!day.day) {
        return res.status(400).json({
          success: false,
          message: 'Each workout day must have a day specified'
        });
      }
      if (!day.focus) {
        return res.status(400).json({
          success: false,
          message: `Day ${day.day} must have a focus area`
        });
      }
      if (!day.exercises || !Array.isArray(day.exercises) || day.exercises.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Day ${day.day} must have at least one exercise`
        });
      }
      // Validate each exercise is a string
      for (const exercise of day.exercises) {
        if (typeof exercise !== 'string' || !exercise.trim()) {
          return res.status(400).json({
            success: false,
            message: `Each exercise must be a non-empty string`
          });
        }
      }
    }

    // Create workout plan
    const workoutPlan = await WorkoutPlan.create({
      trainerId,
      planName,
      planType,
      planLevel,
      totalSessions,
      sessionsPerWeek,
      description: description || null,
      planIcon: planIcon || '💪',
      workoutDays
    });

    res.status(201).json({
      success: true,
      message: 'Workout plan created successfully',
      data: workoutPlan
    });

  } catch (error) {
    console.error('Create workout plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating workout plan',
      error: error.message
    });
  }
};

// @desc    Get all workout plans (trainer's own)
// @route   GET /api/workout-plans/my-plans
// @access  Private (Trainer only)
const getMyWorkoutPlans = async (req, res) => {
  try {
    const trainerId = req.user._id;

    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Only trainers can view their workout plans'
      });
    }

    const workoutPlans = await WorkoutPlan.find({ trainerId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: workoutPlans.length,
      data: workoutPlans
    });

  } catch (error) {
    console.error('Get workout plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching workout plans',
      error: error.message
    });
  }
};

// @desc    Get a single workout plan
// @route   GET /api/workout-plans/:id
// @access  Private
const getWorkoutPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    const workoutPlan = await WorkoutPlan.findById(id);

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: 'Workout plan not found'
      });
    }

    // Check if user has access (trainer owns it or member is assigned)
    if (req.user.role === 'trainer' && workoutPlan.trainerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this workout plan'
      });
    }

    if (req.user.role === 'member') {
      const isAssigned = workoutPlan.assignedMembers.some(
        memberId => memberId.toString() === req.user._id.toString()
      );
      if (!isAssigned && !workoutPlan.isPublic) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this workout plan'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: workoutPlan
    });

  } catch (error) {
    console.error('Get workout plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching workout plan',
      error: error.message
    });
  }
};

// @desc    Update a workout plan
// @route   PUT /api/workout-plans/:id
// @access  Private (Trainer only)
const updateWorkoutPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const trainerId = req.user._id;

    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Only trainers can update workout plans'
      });
    }

    const workoutPlan = await WorkoutPlan.findById(id);

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: 'Workout plan not found'
      });
    }

    // Check if trainer owns this plan
    if (workoutPlan.trainerId.toString() !== trainerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own workout plans'
      });
    }

    const updateData = req.body;

    // Validate workoutDays if provided
    if (updateData.workoutDays) {
      if (!Array.isArray(updateData.workoutDays) || updateData.workoutDays.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one workout day is required'
        });
      }
      for (const day of updateData.workoutDays) {
        if (!day.day || !day.focus || !day.exercises || day.exercises.length === 0) {
          return res.status(400).json({
            success: false,
            message: `Each workout day must have day, focus, and at least one exercise`
          });
        }
        for (const exercise of day.exercises) {
          if (typeof exercise !== 'string' || !exercise.trim()) {
            return res.status(400).json({
              success: false,
              message: `Each exercise must be a non-empty string`
            });
          }
        }
      }
    }

    const updatedPlan = await WorkoutPlan.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Workout plan updated successfully',
      data: updatedPlan
    });

  } catch (error) {
    console.error('Update workout plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating workout plan',
      error: error.message
    });
  }
};

// @desc    Delete a workout plan
// @route   DELETE /api/workout-plans/:id
// @access  Private (Trainer only)
const deleteWorkoutPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const trainerId = req.user._id;

    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Only trainers can delete workout plans'
      });
    }

    const workoutPlan = await WorkoutPlan.findById(id);

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: 'Workout plan not found'
      });
    }

    if (workoutPlan.trainerId.toString() !== trainerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own workout plans'
      });
    }

    await WorkoutPlan.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Workout plan deleted successfully'
    });

  } catch (error) {
    console.error('Delete workout plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting workout plan',
      error: error.message
    });
  }
};

// @desc    Assign workout plan to members
// @route   POST /api/workout-plans/:id/assign
// @access  Private (Trainer only)
const assignWorkoutPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { memberIds } = req.body;
    const trainerId = req.user._id;

    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Only trainers can assign workout plans'
      });
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one member ID is required'
      });
    }

    const workoutPlan = await WorkoutPlan.findById(id);

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: 'Workout plan not found'
      });
    }

    if (workoutPlan.trainerId.toString() !== trainerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only assign your own workout plans'
      });
    }

    // Verify all members exist and are actually members
    const members = await User.find({
      _id: { $in: memberIds },
      role: 'member',
      isActive: true
    });

    if (members.length !== memberIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more member IDs are invalid or inactive'
      });
    }

    // Add members to assigned list (avoid duplicates)
    const existingMembers = workoutPlan.assignedMembers.map(id => id.toString());
    const newMembers = memberIds.filter(id => !existingMembers.includes(id));

    workoutPlan.assignedMembers.push(...newMembers);
    await workoutPlan.save();

    res.status(200).json({
      success: true,
      message: `Workout plan assigned to ${newMembers.length} member(s)`,
      data: workoutPlan
    });

  } catch (error) {
    console.error('Assign workout plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning workout plan',
      error: error.message
    });
  }
};

// @desc    Get all public workout plans (for members)
// @route   GET /api/workout-plans/public
// @access  Public
const getPublicWorkoutPlans = async (req, res) => {
  try {
    const workoutPlans = await WorkoutPlan.find({ 
      isPublic: true,
      isActive: true 
    })
    .populate('trainerId', 'fullName email')
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: workoutPlans.length,
      data: workoutPlans
    });

  } catch (error) {
    console.error('Get public workout plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching public workout plans',
      error: error.message
    });
  }
};

// @desc    Rate a workout plan
// @route   POST /api/workout-plans/:id/rate
// @access  Private (Member only)
const rateWorkoutPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const memberId = req.user._id;

    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can rate workout plans'
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const workoutPlan = await WorkoutPlan.findById(id);

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: 'Workout plan not found'
      });
    }

    // Check if member is assigned to this plan
    const isAssigned = workoutPlan.assignedMembers.some(
      memberId => memberId.toString() === req.user._id.toString()
    );

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You can only rate workout plans assigned to you'
      });
    }

    // Update rating
    const currentTotal = workoutPlan.rating * workoutPlan.totalRatings;
    workoutPlan.totalRatings += 1;
    workoutPlan.rating = (currentTotal + rating) / workoutPlan.totalRatings;
    await workoutPlan.save();

    res.status(200).json({
      success: true,
      message: 'Rating submitted successfully',
      data: {
        rating: workoutPlan.rating,
        totalRatings: workoutPlan.totalRatings
      }
    });

  } catch (error) {
    console.error('Rate workout plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rating workout plan',
      error: error.message
    });
  }
};

module.exports = {
  createWorkoutPlan,
  getMyWorkoutPlans,
  getWorkoutPlanById,
  updateWorkoutPlan,
  deleteWorkoutPlan,
  assignWorkoutPlan,
  getPublicWorkoutPlans,
  rateWorkoutPlan
};