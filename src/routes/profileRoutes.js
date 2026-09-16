const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const upload = require('../config/multer');
const {
  getProfile,
  updateProfile,
  deactivateAccount,
  deleteAccountPermanent,
  changePassword
} = require('../controllers/profileController');
const {
  uploadProfilePicture,
  deleteProfilePicture
} = require('../controllers/profilePictureController');

// All routes require authentication
router.use(protect);

// GET /api/profile/me - Get current user profile
router.get('/me', getProfile);

// PUT /api/profile/update - Update profile
router.put('/update', updateProfile);

// POST /api/profile/upload-picture - Upload profile picture (trainer only)
router.post('/upload-picture', (req, res) => {
  upload.single('profilePicture')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size is 5MB'
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Error uploading file'
      });
    }
    return uploadProfilePicture(req, res);
  });
});

// DELETE /api/profile/delete-picture - Delete profile picture (trainer only)
router.delete('/delete-picture', deleteProfilePicture);

// DELETE /api/profile/deactivate - Soft delete (deactivate account)
router.delete('/deactivate', deactivateAccount);

// DELETE /api/profile/delete-permanent - Permanently delete account
router.delete('/delete-permanent', deleteAccountPermanent);

// PUT /api/profile/change-password - Change password
router.put('/change-password', changePassword);

module.exports = router;