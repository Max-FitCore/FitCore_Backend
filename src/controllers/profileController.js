const User = require('../models/User');
const OTP = require('../models/OTP');

// @desc    Get current user profile
// @route   GET /api/profile/me
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = req.user;
    
    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
};

// @desc    Update profile (works for both member and trainer)
// @route   PUT /api/profile/update
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { 
      fullName, 
      phone, 
      location, 
      bio,
      speciality,
      certifications,
      availability
    } = req.body;
    
    const userId = req.user._id;
    const userRole = req.user.role;

    // Build update object
    const updateData = {};

    // Full name is required for everyone
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required'
      });
    }

    if (fullName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Full name must be at least 2 characters'
      });
    }

    if (fullName.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Full name cannot exceed 50 characters'
      });
    }

    if (!/^[a-zA-Z\s]+$/.test(fullName)) {
      return res.status(400).json({
        success: false,
        message: 'Full name can only contain letters and spaces'
      });
    }

    updateData.fullName = fullName.trim();

    // Common optional fields
    if (phone !== undefined) {
      if (phone && phone.trim()) {
        if (!/^[\d\s\+\-\(\)]{10,15}$/.test(phone.trim())) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid phone number'
          });
        }
        updateData.phone = phone.trim();
      } else {
        updateData.phone = null;
      }
    }

    if (location !== undefined) {
      updateData.location = location && location.trim() ? location.trim() : null;
    }

    if (bio !== undefined) {
      if (bio && bio.trim()) {
        if (bio.trim().length > 500) {
          return res.status(400).json({
            success: false,
            message: 'Bio cannot exceed 500 characters'
          });
        }
        updateData.bio = bio.trim();
      } else {
        updateData.bio = null;
      }
    }

    // Trainer specific fields
    if (userRole === 'trainer') {
      if (speciality !== undefined) {
        if (speciality && speciality.trim()) {
          if (speciality.trim().length > 200) {
            return res.status(400).json({
              success: false,
              message: 'Speciality cannot exceed 200 characters'
            });
          }
          updateData.speciality = speciality.trim();
        } else {
          updateData.speciality = null;
        }
      }

      if (certifications !== undefined) {
        if (certifications && certifications.trim()) {
          if (certifications.trim().length > 500) {
            return res.status(400).json({
              success: false,
              message: 'Certifications cannot exceed 500 characters'
            });
          }
          updateData.certifications = certifications.trim();
        } else {
          updateData.certifications = null;
        }
      }

      if (availability !== undefined) {
        if (availability && availability.trim()) {
          if (availability.trim().length > 500) {
            return res.status(400).json({
              success: false,
              message: 'Availability cannot exceed 500 characters'
            });
          }
          updateData.availability = availability.trim();
        } else {
          updateData.availability = null;
        }
      }
    } else {
      // If member tries to update trainer fields, ignore them
      // (they won't be in the schema for members anyway)
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

// @desc    Soft delete - Deactivate account
// @route   DELETE /api/profile/deactivate
// @access  Private
const deactivateAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Account is already deactivated'
      });
    }

    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully. You can reactivate by contacting support.'
    });

  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating account',
      error: error.message
    });
  }
};

// @desc    Permanently delete account
// @route   DELETE /api/profile/delete-permanent
// @access  Private
const deleteAccountPermanent = async (req, res) => {
  try {
    const userId = req.user._id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to permanently delete your account'
      });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. Account deletion failed.'
      });
    }

    await OTP.deleteMany({ userId: user._id });

    const userEmail = user.email;
    const userRole = user.role;

    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'Account permanently deleted',
      data: {
        email: userEmail,
        role: userRole,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Permanent delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting account',
      error: error.message
    });
  }
};

// @desc    Change password
// @route   PUT /api/profile/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user._id;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password, and confirm password are required'
      });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  deactivateAccount,
  deleteAccountPermanent,
  changePassword
};