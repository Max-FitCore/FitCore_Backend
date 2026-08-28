const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const {
  subscribeToPlan,
  cancelSubscription,
  getMySubscription,
  getSubscriptionHistory,
  toggleAutoRenew,
  getAllSubscriptions
} = require('../controllers/membershipSubscriptionController');

// Member routes (require authentication)
router.use(protect);

// Member only routes
router.post('/subscribe', subscribeToPlan);
router.put('/cancel', cancelSubscription);
router.get('/my-subscription', getMySubscription);
router.get('/history', getSubscriptionHistory);
router.put('/auto-renew', toggleAutoRenew);

// Admin only route
router.get('/admin/all', getAllSubscriptions);

module.exports = router;