const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const {
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
} = require('../controllers/workoutPlanController');

// Public routes
router.get('/public', getPublicWorkoutPlans);

// Protected routes (all require authentication)
router.use(protect);

// Member routes
router.get('/my-workouts', getMyAssignedWorkouts);

// Trainer routes
router.post('/create', createWorkoutPlan);
router.get('/my-plans', getMyWorkoutPlans);
router.get('/:planId/members', getAssignedMembers);
router.get('/member/:memberId', getMemberWorkouts);

// Assignment routes (trainer only)
router.post('/assign/:memberId', assignWorkoutPlan);
router.delete('/unassign/:memberId/:planId', unassignWorkoutPlan);

// General routes (with access control)
router.get('/:id', getWorkoutPlanById);
router.put('/:id', updateWorkoutPlan);
router.delete('/:id', deleteWorkoutPlan);
router.post('/:id/rate', rateWorkoutPlan);

module.exports = router;