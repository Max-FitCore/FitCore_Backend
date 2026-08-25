const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const {
  getProfile,
  updateProfile,
  deactivateAccount,
  deleteAccountPermanent,
  changePassword
} = require('../controllers/profileController');

// All routes require authentication
router.use(protect);

// GET /api/profile/me - Get current user profile
router.get('/me', getProfile);

// PUT /api/profile/update - Update profile
router.put('/update', updateProfile);

// DELETE /api/profile/deactivate - Soft delete (deactivate account)
router.delete('/deactivate', deactivateAccount);

// DELETE /api/profile/delete-permanent - Permanently delete account
router.delete('/delete-permanent', deleteAccountPermanent);

// PUT /api/profile/change-password - Change password
router.put('/change-password', changePassword);

module.exports = router;