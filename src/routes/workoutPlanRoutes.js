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
  getPublicWorkoutPlans,
  rateWorkoutPlan
} = require('../controllers/workoutPlanController');

// Public routes
router.get('/public', getPublicWorkoutPlans);

// Protected routes (all require authentication)
router.use(protect);

// POST /api/workout-plans/create - Create workout plan (trainer only)
router.post('/create', createWorkoutPlan);

// GET /api/workout-plans/my-plans - Get trainer's plans
router.get('/my-plans', getMyWorkoutPlans);

// GET /api/workout-plans/:id - Get single plan
router.get('/:id', getWorkoutPlanById);

// PUT /api/workout-plans/:id - Update plan (trainer only)
router.put('/:id', updateWorkoutPlan);

// DELETE /api/workout-plans/:id - Delete plan (trainer only)
router.delete('/:id', deleteWorkoutPlan);

// POST /api/workout-plans/:id/assign - Assign to members (trainer only)
router.post('/:id/assign', assignWorkoutPlan);

// POST /api/workout-plans/:id/rate - Rate plan (member only)
router.post('/:id/rate', rateWorkoutPlan);

module.exports = router;