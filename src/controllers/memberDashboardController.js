const User = require('../models/User');
const Session = require('../models/Session');
const WorkoutPlan = require('../models/WorkoutPlan');
const MembershipSubscription = require('../models/MembershipSubscription');

// @desc    Get member dashboard stats
// @route   GET /api/member-dashboard/stats
// @access  Private (Member only)
const getMemberDashboardStats = async (req, res) => {
  try {
    const memberId = req.user._id;

    // Check if user is a member
    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Member only.'
      });
    }

    // ============ MEMBERSHIP ============
    const activeSubscription = await MembershipSubscription.findOne({
      memberId,
      status: 'active'
    }).populate('planId', 'planName description duration features price discount');

    const subscriptionHistoryCount = await MembershipSubscription.countDocuments({
      memberId
    });

    // ============ SESSIONS (CLASSES) ============
    const bookedSessions = await Session.find({
      bookedMembers: memberId,
      isActive: true
    })
    .populate('trainerId', 'fullName profilePicture')
    .select('sessionName day time difficulty location currentParticipants maxParticipants');

    const upcomingSessions = bookedSessions.filter(s => !s.isFull || s.currentParticipants < s.maxParticipants);

    const totalBookedSessions = bookedSessions.length;

    // Count sessions by day
    const sessionsByDay = bookedSessions.reduce((acc, session) => {
      acc[session.day] = (acc[session.day] || 0) + 1;
      return acc;
    }, {});

    // ============ WORKOUT PLANS ============
    const assignedWorkouts = await WorkoutPlan.find({
      assignedMembers: memberId,
      isActive: true
    })
    .populate('trainerId', 'fullName profilePicture')
    .select('planName planType planLevel planIcon totalSessions sessionsPerWeek workoutDays description rating');

    const totalAssignedPlans = assignedWorkouts.length;

    // Count total exercises across all plans
    const totalExercises = assignedWorkouts.reduce((total, plan) => {
      return total + plan.workoutDays.reduce((dayTotal, day) => {
        return dayTotal + day.exercises.length;
      }, 0);
    }, 0);

    // Count plans by type
    const plansByType = assignedWorkouts.reduce((acc, plan) => {
      acc[plan.planType] = (acc[plan.planType] || 0) + 1;
      return acc;
    }, {});

    // Count plans by level
    const plansByLevel = assignedWorkouts.reduce((acc, plan) => {
      acc[plan.planLevel] = (acc[plan.planLevel] || 0) + 1;
      return acc;
    }, {});

    // ============ ACTIVITY ============
    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[today.getDay()];

    // Today's sessions
    const todaySessions = bookedSessions.filter(s => s.day === todayName);

    // Today's workout plan (if any plan has today's workout)
    const todayWorkouts = assignedWorkouts.filter(plan =>
      plan.workoutDays.some(day => day.day === todayName)
    ).map(plan => ({
      planId: plan._id,
      planName: plan.planName,
      planIcon: plan.planIcon,
      workout: plan.workoutDays.find(day => day.day === todayName)
    }));

    // ============ PROFILE COMPLETION ============
    const user = await User.findById(memberId).select('fullName email phone location bio profilePicture isVerified memberDetails');

    const profileFields = [
      { field: 'fullName', value: user.fullName },
      { field: 'email', value: user.email },
      { field: 'phone', value: user.phone },
      { field: 'location', value: user.location },
      { field: 'bio', value: user.bio },
      { field: 'profilePicture', value: user.profilePicture?.url },
      { field: 'dateOfBirth', value: user.memberDetails?.dateOfBirth },
      { field: 'gender', value: user.memberDetails?.gender },
      { field: 'emergencyContact', value: user.memberDetails?.emergencyContact?.name },
      { field: 'fitnessGoals', value: user.memberDetails?.fitnessGoals?.length > 0 }
    ];

    const completedFields = profileFields.filter(f => f.value).length;
    const profileCompletion = Math.round((completedFields / profileFields.length) * 100);

    const missingFields = profileFields
      .filter(f => !f.value)
      .map(f => f.field);

    // ============ SUBSCRIPTION INFO ============
    let subscriptionInfo = null;
    if (activeSubscription) {
      const daysRemaining = Math.max(0, Math.ceil(
        (activeSubscription.endDate - new Date()) / (1000 * 60 * 60 * 24)
      ));

      subscriptionInfo = {
        subscriptionId: activeSubscription._id,
        planName: activeSubscription.planId.planName,
        planDescription: activeSubscription.planId.description,
        duration: activeSubscription.planId.duration,
        features: activeSubscription.planId.features,
        startDate: activeSubscription.startDate,
        endDate: activeSubscription.endDate,
        daysRemaining,
        autoRenew: activeSubscription.autoRenew,
        status: activeSubscription.status,
        price: activeSubscription.finalPrice,
        paymentMethod: activeSubscription.paymentMethod
      };
    }

    // ============ RESPONSE ============
    res.status(200).json({
      success: true,
      data: {
        // Overview Cards
        overview: {
          hasActiveSubscription: !!activeSubscription,
          totalBookedSessions,
          totalAssignedPlans,
          totalExercises,
          totalSubscriptionsHistory: subscriptionHistoryCount,
          profileCompletion
        },

        // Subscription Details
        subscription: subscriptionInfo,

        // Today's Activity
        today: {
          day: todayName,
          date: today.toISOString().split('T')[0],
          sessions: todaySessions.map(s => ({
            _id: s._id,
            sessionName: s.sessionName,
            time: s.time,
            difficulty: s.difficulty,
            location: s.location,
            trainer: s.trainerId ? {
              name: s.trainerId.fullName,
              picture: s.trainerId.profilePicture
            } : null
          })),
          workouts: todayWorkouts,
          totalActivities: todaySessions.length + todayWorkouts.length
        },

        // Booked Sessions
        sessions: {
          total: totalBookedSessions,
          byDay: sessionsByDay,
          upcoming: upcomingSessions.map(s => ({
            _id: s._id,
            sessionName: s.sessionName,
            day: s.day,
            time: s.time,
            difficulty: s.difficulty,
            location: s.location,
            trainer: s.trainerId ? {
              name: s.trainerId.fullName,
              picture: s.trainerId.profilePicture
            } : null
          }))
        },

        // Workout Plans
        workouts: {
          total: totalAssignedPlans,
          byType: plansByType,
          byLevel: plansByLevel,
          plans: assignedWorkouts.map(plan => ({
            _id: plan._id,
            planName: plan.planName,
            planType: plan.planType,
            planLevel: plan.planLevel,
            planIcon: plan.planIcon,
            totalSessions: plan.totalSessions,
            sessionsPerWeek: plan.sessionsPerWeek,
            totalExercises: plan.workoutDays.reduce((sum, d) => sum + d.exercises.length, 0),
            rating: plan.rating,
            trainer: plan.trainerId ? {
              name: plan.trainerId.fullName,
              picture: plan.trainerId.profilePicture
            } : null
          }))
        },

        // Profile Completion
        profile: {
          completion: profileCompletion,
          missingFields,
          isVerified: user.isVerified,
          hasProfilePicture: !!user.profilePicture?.url
        }
      }
    });

  } catch (error) {
    console.error('Get member dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard stats',
      error: error.message
    });
  }
};

module.exports = {
  getMemberDashboardStats
};