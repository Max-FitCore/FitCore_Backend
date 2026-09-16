const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const { getTrainerDashboardStats } = require('../controllers/trainerDashboardController');

// All routes require authentication
router.use(protect);

// GET /api/trainer-dashboard/stats - Get trainer dashboard stats
router.get('/stats', getTrainerDashboardStats);

module.exports = router;