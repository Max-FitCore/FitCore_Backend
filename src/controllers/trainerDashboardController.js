const User = require('../models/User');
const Session = require('../models/Session');
const WorkoutPlan = require('../models/WorkoutPlan');

// @desc    Get trainer dashboard stats
// @route   GET /api/trainer-dashboard/stats
// @access  Private (Trainer only)
const getTrainerDashboardStats = async (req, res) => {
  try {
    const trainerId = req.user._id;

    // Check if user is a trainer
    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Trainer only.'
      });
    }

    // ============ PROFILE ============
    const trainer = await User.findById(trainerId)
      .select('fullName email phone location bio profilePicture speciality certifications availability isVerified createdAt');

    // Profile completion calculation
    const profileFields = [
      { field: 'fullName', value: trainer.fullName },
      { field: 'email', value: trainer.email },
      { field: 'phone', value: trainer.phone },
      { field: 'location', value: trainer.location },
      { field: 'bio', value: trainer.bio },
      { field: 'profilePicture', value: trainer.profilePicture?.url },
      { field: 'speciality', value: trainer.speciality },
      { field: 'certifications', value: trainer.certifications },
      { field: 'availability', value: trainer.availability }
    ];

    const completedFields = profileFields.filter(f => f.value).length;
    const profileCompletion = Math.round((completedFields / profileFields.length) * 100);

    const missingFields = profileFields
      .filter(f => !f.value)
      .map(f => f.field);

    // ============ SESSIONS ============
    const allSessions = await Session.find({ trainerId })
      .populate('bookedMembers', 'fullName email profilePicture')
      .sort({ day: 1, time: 1 });

    const activeSessions = allSessions.filter(s => s.isActive);

    const totalSessions = activeSessions.length;

    // Total unique members who booked at least one session
    const uniqueMemberIds = new Set();
    activeSessions.forEach(session => {
      session.bookedMembers.forEach(member => {
        uniqueMemberIds.add(member._id.toString());
      });
    });
    const totalUniqueMembers = uniqueMemberIds.size;

    // Total bookings across all sessions
    const totalBookings = activeSessions.reduce(
      (sum, session) => sum + session.bookedMembers.length,
      0
    );

    // Average participants per session
    const averageParticipants = totalSessions > 0
      ? Math.round((totalBookings / totalSessions) * 10) / 10
      : 0;

    // Sessions by day
    const sessionsByDay = activeSessions.reduce((acc, session) => {
      acc[session.day] = (acc[session.day] || 0) + 1;
      return acc;
    }, {});

    // Sessions by difficulty
    const sessionsByDifficulty = activeSessions.reduce((acc, session) => {
      acc[session.difficulty] = (acc[session.difficulty] || 0) + 1;
      return acc;
    }, {});

    // Most popular sessions (by booked members count)
    const popularSessions = [...activeSessions]
      .sort((a, b) => b.bookedMembers.length - a.bookedMembers.length)
      .slice(0, 5)
      .map(s => ({
        _id: s._id,
        sessionName: s.sessionName,
        day: s.day,
        time: s.time,
        difficulty: s.difficulty,
        location: s.location,
        currentParticipants: s.bookedMembers.length,
        maxParticipants: s.maxParticipants,
        availableSpots: s.maxParticipants - s.bookedMembers.length,
        isFull: s.bookedMembers.length >= s.maxParticipants
      }));

    // Full sessions (no spots left)
    const fullSessionsCount = activeSessions.filter(
      s => s.bookedMembers.length >= s.maxParticipants
    ).length;

    // ============ WORKOUT PLANS ============
    const workoutPlans = await WorkoutPlan.find({ trainerId })
      .populate('assignedMembers', 'fullName email profilePicture')
      .sort({ createdAt: -1 });

    const activePlans = workoutPlans.filter(p => p.isActive);

    const totalWorkoutPlans = activePlans.length;

    // Unique members assigned to at least one plan
    const uniqueAssignedMemberIds = new Set();
    activePlans.forEach(plan => {
      plan.assignedMembers.forEach(member => {
        uniqueAssignedMemberIds.add(member._id.toString());
      });
    });
    const totalAssignedMembers = uniqueAssignedMemberIds.size;

    // Total assignments (plan-member pairs)
    const totalAssignments = activePlans.reduce(
      (sum, plan) => sum + plan.assignedMembers.length,
      0
    );

    // Plans by type
    const plansByType = activePlans.reduce((acc, plan) => {
      acc[plan.planType] = (acc[plan.planType] || 0) + 1;
      return acc;
    }, {});

    // Plans by level
    const plansByLevel = activePlans.reduce((acc, plan) => {
      acc[plan.planLevel] = (acc[plan.planLevel] || 0) + 1;
      return acc;
    }, {});

    // Most popular plans (by assigned members)
    const popularPlans = [...activePlans]
      .sort((a, b) => b.assignedMembers.length - a.assignedMembers.length)
      .slice(0, 5)
      .map(p => ({
        _id: p._id,
        planName: p.planName,
        planType: p.planType,
        planLevel: p.planLevel,
        planIcon: p.planIcon,
        assignedCount: p.assignedMembers.length,
        rating: p.rating,
        totalRatings: p.totalRatings,
        totalExercises: p.workoutDays.reduce((sum, d) => sum + d.exercises.length, 0)
      }));

    // Average plan rating
    const plansWithRatings = activePlans.filter(p => p.totalRatings > 0);
    const averageRating = plansWithRatings.length > 0
      ? Math.round(
          (plansWithRatings.reduce((sum, p) => sum + p.rating, 0) / plansWithRatings.length) * 10
        ) / 10
      : 0;

    // ============ TODAY'S ACTIVITY ============
    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[today.getDay()];

    const todaySessions = activeSessions
      .filter(s => s.day === todayName)
      .map(s => ({
        _id: s._id,
        sessionName: s.sessionName,
        time: s.time,
        difficulty: s.difficulty,
        location: s.location,
        currentParticipants: s.bookedMembers.length,
        maxParticipants: s.maxParticipants,
        availableSpots: s.maxParticipants - s.bookedMembers.length,
        participants: s.bookedMembers.map(m => ({
          _id: m._id,
          fullName: m.fullName,
          email: m.email,
          profilePicture: m.profilePicture
        }))
      }));

    // ============ TOP MEMBERS ============
    // Members who booked the most sessions with this trainer
    const memberBookingCount = {};
    activeSessions.forEach(session => {
      session.bookedMembers.forEach(member => {
        const id = member._id.toString();
        if (!memberBookingCount[id]) {
          memberBookingCount[id] = {
            member: {
              _id: member._id,
              fullName: member.fullName,
              email: member.email,
              profilePicture: member.profilePicture
            },
            sessionBookings: 0,
            workoutPlans: 0
          };
        }
        memberBookingCount[id].sessionBookings += 1;
      });
    });

    // Add workout plan counts
    activePlans.forEach(plan => {
      plan.assignedMembers.forEach(member => {
        const id = member._id.toString();
        if (memberBookingCount[id]) {
          memberBookingCount[id].workoutPlans += 1;
        } else {
          memberBookingCount[id] = {
            member: {
              _id: member._id,
              fullName: member.fullName,
              email: member.email,
              profilePicture: member.profilePicture
            },
            sessionBookings: 0,
            workoutPlans: 1
          };
        }
      });
    });

    const topMembers = Object.values(memberBookingCount)
      .sort((a, b) => 
        (b.sessionBookings + b.workoutPlans) - (a.sessionBookings + a.workoutPlans)
      )
      .slice(0, 5)
      .map(item => ({
        _id: item.member._id,
        fullName: item.member.fullName,
        email: item.member.email,
        profilePicture: item.member.profilePicture,
        sessionBookings: item.sessionBookings,
        workoutPlans: item.workoutPlans,
        totalEngagement: item.sessionBookings + item.workoutPlans
      }));

    // ============ RESPONSE ============
    res.status(200).json({
      success: true,
      data: {
        // Overview Cards
        overview: {
          totalSessions,
          totalWorkoutPlans,
          totalUniqueMembers,
          totalBookings,
          totalAssignments,
          averageParticipants,
          fullSessionsCount,
          averageRating,
          profileCompletion,
          isVerified: trainer.isVerified
        },

        // Sessions stats
        sessions: {
          total: totalSessions,
          totalBookings,
          averageParticipants,
          fullSessions: fullSessionsCount,
          byDay: sessionsByDay,
          byDifficulty: sessionsByDifficulty,
          popular: popularSessions
        },

        // Workout plans stats
        plans: {
          total: totalWorkoutPlans,
          totalAssignments,
          totalAssignedMembers,
          averageRating,
          byType: plansByType,
          byLevel: plansByLevel,
          popular: popularPlans
        },

        // Today's schedule
        today: {
          day: todayName,
          date: today.toISOString().split('T')[0],
          sessions: todaySessions,
          totalSessionsToday: todaySessions.length,
          totalParticipantsToday: todaySessions.reduce(
            (sum, s) => sum + s.currentParticipants, 0
          )
        },

        // Top members (most engaged)
        topMembers,

        // Profile status
        profile: {
          completion: profileCompletion,
          missingFields,
          isVerified: trainer.isVerified,
          hasProfilePicture: !!trainer.profilePicture?.url,
          speciality: trainer.speciality,
          certifications: trainer.certifications,
          availability: trainer.availability,
          memberSince: trainer.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Get trainer dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard stats',
      error: error.message
    });
  }
};

module.exports = {
  getTrainerDashboardStats
};