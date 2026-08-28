const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const {
  createMembershipPlan,
  getAllMembershipPlans,
  getMembershipPlanById,
  updateMembershipPlan,
  deleteMembershipPlan,
  getPublicMembershipPlans
} = require('../controllers/membershipPlanController');

// Public routes (for members)
router.get('/public', getPublicMembershipPlans);

// Admin routes (require authentication and admin role)
router.use(protect);

// Admin only routes
router.post('/', createMembershipPlan);
router.get('/', getAllMembershipPlans);
router.get('/:id', getMembershipPlanById);
router.put('/:id', updateMembershipPlan);
router.delete('/:id', deleteMembershipPlan);

module.exports = router;