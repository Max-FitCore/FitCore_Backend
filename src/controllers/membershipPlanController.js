const MembershipPlan = require('../models/MembershipPlan');

// @desc    Create a new membership plan
// @route   POST /api/admin/membership-plans
// @access  Private (Admin only)
const createMembershipPlan = async (req, res) => {
  try {
    const {
      planName,
      price,
      description,
      features,
      duration,
      isPopular,
      discount
    } = req.body;

    // Check if user is admin
    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    // Validate required fields
    if (!planName || price === undefined || !description || !features) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: planName, price, description, features'
      });
    }

    // Validate features is an array
    if (!Array.isArray(features) || features.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Features must be a non-empty array'
      });
    }

    // Check if plan name already exists
    const existingPlan = await MembershipPlan.findOne({ planName });
    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: 'A plan with this name already exists'
      });
    }

    // Create membership plan
    const membershipPlan = await MembershipPlan.create({
      planName,
      price,
      description,
      features,
      duration: duration || 'Monthly',
      isPopular: isPopular || false,
      discount: discount || 0
    });

    res.status(201).json({
      success: true,
      message: 'Membership plan created successfully',
      data: membershipPlan
    });

  } catch (error) {
    console.error('Create membership plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating membership plan',
      error: error.message
    });
  }
};

// @desc    Get all membership plans
// @route   GET /api/admin/membership-plans
// @access  Private (Admin only)
const getAllMembershipPlans = async (req, res) => {
  try {
    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const plans = await MembershipPlan.find()
      .sort({ price: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans
    });

  } catch (error) {
    console.error('Get all membership plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching membership plans',
      error: error.message
    });
  }
};

// @desc    Get a single membership plan
// @route   GET /api/admin/membership-plans/:id
// @access  Private (Admin only)
const getMembershipPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const plan = await MembershipPlan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Membership plan not found'
      });
    }

    res.status(200).json({
      success: true,
      data: plan
    });

  } catch (error) {
    console.error('Get membership plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching membership plan',
      error: error.message
    });
  }
};

// @desc    Update a membership plan
// @route   PUT /api/admin/membership-plans/:id
// @access  Private (Admin only)
const updateMembershipPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      planName,
      price,
      description,
      features,
      duration,
      isActive,
      isPopular,
      discount
    } = req.body;

    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const plan = await MembershipPlan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Membership plan not found'
      });
    }

    // Build update object
    const updateData = {};

    if (planName !== undefined) {
      if (!planName || !planName.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Plan name is required'
        });
      }
      if (planName.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Plan name must be at least 3 characters'
        });
      }
      // Check if plan name already exists (excluding current plan)
      const existingPlan = await MembershipPlan.findOne({
        planName: planName.trim(),
        _id: { $ne: id }
      });
      if (existingPlan) {
        return res.status(400).json({
          success: false,
          message: 'A plan with this name already exists'
        });
      }
      updateData.planName = planName.trim();
    }

    if (price !== undefined) {
      if (price < 0) {
        return res.status(400).json({
          success: false,
          message: 'Price cannot be negative'
        });
      }
      updateData.price = price;
    }

    if (description !== undefined) {
      if (!description || !description.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Description is required'
        });
      }
      if (description.trim().length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Description cannot exceed 500 characters'
        });
      }
      updateData.description = description.trim();
    }

    if (features !== undefined) {
      if (!Array.isArray(features) || features.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Features must be a non-empty array'
        });
      }
      // Validate each feature
      for (const feature of features) {
        if (!feature || !feature.trim() || feature.trim().length < 2) {
          return res.status(400).json({
            success: false,
            message: 'Each feature must be at least 2 characters'
          });
        }
      }
      updateData.features = features.map(f => f.trim());
    }

    if (duration !== undefined) {
      const validDurations = ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'];
      if (!validDurations.includes(duration)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid duration. Must be Monthly, Quarterly, Half-Yearly, or Yearly'
        });
      }
      updateData.duration = duration;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    if (isPopular !== undefined) {
      updateData.isPopular = isPopular;
    }

    if (discount !== undefined) {
      if (discount < 0 || discount > 100) {
        return res.status(400).json({
          success: false,
          message: 'Discount must be between 0 and 100'
        });
      }
      updateData.discount = discount;
    }

    const updatedPlan = await MembershipPlan.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Membership plan updated successfully',
      data: updatedPlan
    });

  } catch (error) {
    console.error('Update membership plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating membership plan',
      error: error.message
    });
  }
};

// @desc    Delete a membership plan
// @route   DELETE /api/admin/membership-plans/:id
// @access  Private (Admin only)
const deleteMembershipPlan = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const plan = await MembershipPlan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Membership plan not found'
      });
    }

    const planName = plan.planName;

    // Permanently delete the plan
    await MembershipPlan.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: `Membership plan "${planName}" deleted successfully`,
      data: {
        planName: planName,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Delete membership plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting membership plan',
      error: error.message
    });
  }
};

// @desc    Get public membership plans (for members)
// @route   GET /api/membership-plans
// @access  Public
const getPublicMembershipPlans = async (req, res) => {
  try {
    const plans = await MembershipPlan.find({ 
      isActive: true 
    }).sort({ price: 1 });

    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans
    });

  } catch (error) {
    console.error('Get public membership plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching membership plans',
      error: error.message
    });
  }
};

module.exports = {
  createMembershipPlan,
  getAllMembershipPlans,
  getMembershipPlanById,
  updateMembershipPlan,
  deleteMembershipPlan,
  getPublicMembershipPlans
};