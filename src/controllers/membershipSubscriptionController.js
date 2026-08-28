const MembershipSubscription = require('../models/MembershipSubscription');
const MembershipPlan = require('../models/MembershipPlan');
const User = require('../models/User');

// @desc    Subscribe to a membership plan
// @route   POST /api/membership/subscribe
// @access  Private (Member only)
const subscribeToPlan = async (req, res) => {
  try {
    const { 
      planId, 
      paymentMethod, 
      autoRenew 
    } = req.body;

    const memberId = req.user._id;

    // Check if user is a member
    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can subscribe to plans'
      });
    }

    // Validate required fields
    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required'
      });
    }

    // Check if plan exists and is active
    const plan = await MembershipPlan.findOne({
      _id: planId,
      isActive: true
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Membership plan not found or inactive'
      });
    }

    // Check if member already has an active subscription
    const existingSubscription = await MembershipSubscription.findOne({
      memberId,
      status: 'active'
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active subscription. Please cancel it first.',
        data: {
          subscriptionId: existingSubscription._id,
          planName: existingSubscription.planName,
          endDate: existingSubscription.endDate
        }
      });
    }

    // Calculate end date based on plan duration
    const startDate = new Date();
    let endDate = new Date(startDate);
    
    switch (plan.duration) {
      case 'Monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'Quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'Half-Yearly':
        endDate.setMonth(endDate.getMonth() + 6);
        break;
      case 'Yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
    }

    // Calculate final price with discount
    const finalPrice = plan.discountedPrice || plan.price;

    // Create subscription
    const subscription = await MembershipSubscription.create({
      memberId,
      planId,
      status: 'active',
      startDate,
      endDate,
      price: plan.price,
      discountApplied: plan.discount || 0,
      finalPrice,
      paymentMethod: paymentMethod || 'credit_card',
      paymentStatus: 'paid', // In a real app, this would be set after payment confirmation
      autoRenew: autoRenew !== undefined ? autoRenew : true
    });

    // Populate plan details for response
    await subscription.populate('planId', 'planName description duration');

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to membership plan',
      data: {
        subscription,
        plan: {
          id: plan._id,
          planName: plan.planName,
          duration: plan.duration,
          price: plan.price,
          discount: plan.discount,
          finalPrice: finalPrice
        },
        startDate,
        endDate,
        daysRemaining: subscription.daysRemaining
      }
    });

  } catch (error) {
    console.error('Subscribe to plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error subscribing to membership plan',
      error: error.message
    });
  }
};

// @desc    Cancel subscription
// @route   PUT /api/membership/cancel
// @access  Private (Member only)
const cancelSubscription = async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    const memberId = req.user._id;

    // Check if user is a member
    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can cancel subscriptions'
      });
    }

    // Find active subscription
    const subscription = await MembershipSubscription.findOne({
      memberId,
      status: 'active'
    }).populate('planId', 'planName duration price');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    // Update subscription status
    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = cancellationReason || 'User cancelled';
    subscription.autoRenew = false;
    await subscription.save();

    // Get days remaining until end date
    const daysRemaining = subscription.daysRemaining;

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: {
        subscription: {
          _id: subscription._id,
          status: subscription.status,
          cancelledAt: subscription.cancelledAt,
          cancellationReason: subscription.cancellationReason
        },
        plan: {
          planName: subscription.planId.planName,
          duration: subscription.planId.duration
        },
        endDate: subscription.endDate,
        daysRemaining: daysRemaining,
        note: `Your subscription will remain active until ${subscription.endDate.toLocaleDateString()}`
      }
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling subscription',
      error: error.message
    });
  }
};

// @desc    Get my current subscription
// @route   GET /api/membership/my-subscription
// @access  Private (Member only)
const getMySubscription = async (req, res) => {
  try {
    const memberId = req.user._id;

    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can view their subscription'
      });
    }

    const subscription = await MembershipSubscription.findOne({
      memberId,
      status: { $in: ['active', 'pending'] }
    })
    .populate('planId', 'planName description duration features isPopular')
    .sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    // Check if expired
    if (subscription.isExpired) {
      subscription.status = 'expired';
      await subscription.save();
    }

    res.status(200).json({
      success: true,
      data: {
        subscription,
        daysRemaining: subscription.daysRemaining,
        isExpired: subscription.isExpired,
        endDate: subscription.endDate
      }
    });

  } catch (error) {
    console.error('Get my subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription',
      error: error.message
    });
  }
};

// @desc    Get subscription history (all subscriptions)
// @route   GET /api/membership/history
// @access  Private (Member only)
const getSubscriptionHistory = async (req, res) => {
  try {
    const memberId = req.user._id;

    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can view their subscription history'
      });
    }

    const subscriptions = await MembershipSubscription.find({
      memberId
    })
    .populate('planId', 'planName duration price')
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions
    });

  } catch (error) {
    console.error('Get subscription history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription history',
      error: error.message
    });
  }
};

// @desc    Toggle auto-renew
// @route   PUT /api/membership/auto-renew
// @access  Private (Member only)
const toggleAutoRenew = async (req, res) => {
  try {
    const { autoRenew } = req.body;
    const memberId = req.user._id;

    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can update auto-renew'
      });
    }

    if (autoRenew === undefined) {
      return res.status(400).json({
        success: false,
        message: 'autoRenew value is required (true/false)'
      });
    }

    const subscription = await MembershipSubscription.findOne({
      memberId,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    subscription.autoRenew = autoRenew;
    await subscription.save();

    res.status(200).json({
      success: true,
      message: `Auto-renew ${autoRenew ? 'enabled' : 'disabled'} successfully`,
      data: {
        autoRenew: subscription.autoRenew
      }
    });

  } catch (error) {
    console.error('Toggle auto-renew error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating auto-renew',
      error: error.message
    });
  }
};

// @desc    Admin: Get all subscriptions
// @route   GET /api/admin/subscriptions
// @access  Private (Admin only)
const getAllSubscriptions = async (req, res) => {
  try {
    if (req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const subscriptions = await MembershipSubscription.find()
      .populate('memberId', 'fullName email phone')
      .populate('planId', 'planName duration price')
      .sort({ createdAt: -1 });

    // Add stats
    const activeCount = subscriptions.filter(s => s.status === 'active').length;
    const cancelledCount = subscriptions.filter(s => s.status === 'cancelled').length;
    const expiredCount = subscriptions.filter(s => s.status === 'expired').length;

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      stats: {
        active: activeCount,
        cancelled: cancelledCount,
        expired: expiredCount
      },
      data: subscriptions
    });

  } catch (error) {
    console.error('Get all subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscriptions',
      error: error.message
    });
  }
};

module.exports = {
  subscribeToPlan,
  cancelSubscription,
  getMySubscription,
  getSubscriptionHistory,
  toggleAutoRenew,
  getAllSubscriptions
};