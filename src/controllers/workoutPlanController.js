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

    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Only trainers can create workout plans'
      });
    }

    if (!planName || !planType || !planLevel || !totalSessions || !sessionsPerWeek) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: planName, planType, planLevel, totalSessions, sessionsPerWeek'
      });
    }

    if (!workoutDays || !Array.isArray(workoutDays) || workoutDays.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one workout day is required'
      });
    }

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
      for (const exercise of day.exercises) {
        if (typeof exercise !== 'string' || !exercise.trim()) {
          return res.status(400).json({
            success: false,
            message: `Each exercise must be a non-empty string`
          });
        }
      }
    }

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

    if (workoutPlan.trainerId.toString() !== trainerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own workout plans'
      });
    }

    const updateData = req.body;

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

// @desc    Assign workout plan to one or multiple members
// @route   POST /api/workout-plans/assign/:planId
// @access  Private (Trainer only)
const assignWorkoutPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const { memberIds } = req.body;
    const trainerId = req.user._id;

    // Check if user is a trainer
    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Only trainers can assign workout plans'
      });
    }

    // Validate planId
    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required in the URL'
      });
    }

    // Validate memberIds
    if (!memberIds) {
      return res.status(400).json({
        success: false,
        message: 'memberIds is required in the body'
      });
    }

    // Support both single string and array
    let memberIdsArray;
    if (Array.isArray(memberIds)) {
      memberIdsArray = memberIds;
    } else if (typeof memberIds === 'string') {
      memberIdsArray = [memberIds];
    } else {
      return res.status(400).json({
        success: false,
        message: 'memberIds must be a string or an array of strings'
      });
    }

    if (memberIdsArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one member ID is required'
      });
    }

    // Check if workout plan exists and belongs to trainer
    const workoutPlan = await WorkoutPlan.findOne({
      _id: planId,
      trainerId: trainerId
    });

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: 'Workout plan not found or you do not own it'
      });
    }

    // Verify all members exist and are actually members
    const members = await User.find({
      _id: { $in: memberIdsArray },
      role: 'member',
      isActive: true
    });

    // Find which member IDs are invalid
    const foundMemberIds = members.map(m => m._id.toString());
    const invalidMemberIds = memberIdsArray.filter(
      id => !foundMemberIds.includes(id.toString())
    );

    if (invalidMemberIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some member IDs are invalid, inactive, or not members',
        invalidMemberIds
      });
    }

    // Get currently assigned members
    const existingMemberIds = workoutPlan.assignedMembers.map(id => id.toString());

    // Separate into new assignments and already assigned
    const alreadyAssigned = memberIdsArray.filter(id =>
      existingMemberIds.includes(id.toString())
    );

    const newMemberIds = memberIdsArray.filter(id =>
      !existingMemberIds.includes(id.toString())
    );

    // If no new members to add
    if (newMemberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All specified members are already assigned to this plan',
        alreadyAssigned: members.filter(m =>
          alreadyAssigned.includes(m._id.toString())
        ).map(m => ({
          _id: m._id,
          fullName: m.fullName,
          email: m.email
        }))
      });
    }

    // Add new members to the plan
    workoutPlan.assignedMembers.push(...newMemberIds);
    await workoutPlan.save();

    // Prepare response data
    const newlyAssignedMembers = members.filter(m =>
      newMemberIds.includes(m._id.toString())
    ).map(m => ({
      _id: m._id,
      fullName: m.fullName,
      email: m.email
    }));

    const alreadyAssignedMembers = members.filter(m =>
      alreadyAssigned.includes(m._id.toString())
    ).map(m => ({
      _id: m._id,
      fullName: m.fullName,
      email: m.email
    }));

    res.status(200).json({
      success: true,
      message: `Workout plan "${workoutPlan.planName}" assigned to ${newlyAssignedMembers.length} member(s) successfully`,
      data: {
        workoutPlan: {
          _id: workoutPlan._id,
          planName: workoutPlan.planName,
          planType: workoutPlan.planType,
          planLevel: workoutPlan.planLevel
        },
        summary: {
          totalRequested: memberIdsArray.length,
          newlyAssigned: newlyAssignedMembers.length,
          alreadyAssigned: alreadyAssignedMembers.length,
          totalAssignedNow: workoutPlan.assignedMembers.length
        },
        newlyAssignedMembers,
        alreadyAssignedMembers: alreadyAssignedMembers.length > 0 
          ? alreadyAssignedMembers 
          : []
      }
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

// @desc    Unassign workout plan from a member
// @route   DELETE /api/workout-plans/unassign/:memberId/:planId
// @access  Private (Trainer only)
const unassignWorkoutPlan = async (req, res) => {
  try {
    const { memberId, planId } = req.params;
    const trainerId = req.user._id;

    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Only trainers can unassign workout plans'
      });
    }

    const member = await User.findOne({
      _id: memberId,
      role: 'member'
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const workoutPlan = await WorkoutPlan.findOne({
      _id: planId,
      trainerId: trainerId
    });

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: 'Workout plan not found or you do not own it'
      });
    }

    if (!workoutPlan.assignedMembers.includes(memberId)) {
      return res.status(400).json({
        success: false,
        message: 'This member is not assigned to this workout plan'
      });
    }

    workoutPlan.assignedMembers = workoutPlan.assignedMembers.filter(
      id => id.toString() !== memberId.toString()
    );
    await workoutPlan.save();

    res.status(200).json({
      success: true,
      message: `Workout plan "${workoutPlan.planName}" unassigned from ${member.fullName} successfully`,
      data: {
        member: {
          _id: member._id,
          fullName: member.fullName,
          email: member.email
        },
        workoutPlan: {
          _id: workoutPlan._id,
          planName: workoutPlan.planName,
          planType: workoutPlan.planType
        }
      }
    });

  } catch (error) {
    console.error('Unassign workout plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error unassigning workout plan',
      error: error.message
    });
  }
};

// @desc    Get all members assigned to a workout plan
// @route   GET /api/workout-plans/:planId/members
// @access  Private (Trainer only)
const getAssignedMembers = async (req, res) => {
  try {
    const { planId } = req.params;
    const trainerId = req.user._id;

    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Only trainers can view assigned members'
      });
    }

    const workoutPlan = await WorkoutPlan.findOne({
      _id: planId,
      trainerId: trainerId
    }).populate('assignedMembers', 'fullName email phone location isActive');

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: 'Workout plan not found or you do not own it'
      });
    }

    res.status(200).json({
      success: true,
      count: workoutPlan.assignedMembers.length,
      data: {
        planName: workoutPlan.planName,
        members: workoutPlan.assignedMembers
      }
    });

  } catch (error) {
    console.error('Get assigned members error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assigned members',
      error: error.message
    });
  }
};

// @desc    Get all workout plans assigned to a member
// @route   GET /api/workout-plans/member/:memberId
// @access  Private (Trainer only)
const getMemberWorkouts = async (req, res) => {
  try {
    const { memberId } = req.params;
    const trainerId = req.user._id;

    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Only trainers can view member workouts'
      });
    }

    const member = await User.findOne({
      _id: memberId,
      role: 'member'
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const workoutPlans = await WorkoutPlan.find({
      trainerId: trainerId,
      assignedMembers: memberId
    }).select('planName planType planLevel planIcon totalSessions sessionsPerWeek workoutDays createdAt');

    res.status(200).json({
      success: true,
      count: workoutPlans.length,
      data: {
        member: {
          _id: member._id,
          fullName: member.fullName,
          email: member.email
        },
        workoutPlans: workoutPlans
      }
    });

  } catch (error) {
    console.error('Get member workouts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching member workouts',
      error: error.message
    });
  }
};

// @desc    Get my assigned workouts (for members)
// @route   GET /api/workout-plans/my-workouts
// @access  Private (Member only)
const getMyAssignedWorkouts = async (req, res) => {
  try {
    const memberId = req.user._id;

    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can view their assigned workouts'
      });
    }

    const workoutPlans = await WorkoutPlan.find({
      assignedMembers: memberId,
      isActive: true
    })
    .populate('trainerId', 'fullName email')
    .select('planName planType planLevel planIcon totalSessions sessionsPerWeek workoutDays description createdAt');

    res.status(200).json({
      success: true,
      count: workoutPlans.length,
      data: workoutPlans
    });

  } catch (error) {
    console.error('Get my assigned workouts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your workouts',
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

    const isAssigned = workoutPlan.assignedMembers.some(
      memberId => memberId.toString() === req.user._id.toString()
    );

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You can only rate workout plans assigned to you'
      });
    }

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
  unassignWorkoutPlan,
  getAssignedMembers,
  getMemberWorkouts,
  getMyAssignedWorkouts,
  getPublicWorkoutPlans,
  rateWorkoutPlan
};