const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const { getMemberDashboardStats } = require('../controllers/memberDashboardController');

// All routes require authentication
router.use(protect);

// GET /api/member-dashboard/stats - Get member dashboard stats
router.get('/stats', getMemberDashboardStats);

module.exports = router;