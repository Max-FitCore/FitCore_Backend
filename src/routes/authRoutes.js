const express = require('express');
const router = express.Router();
const { 
  signup, 
  login, 
  verifyEmail, 
  resendOTP,
  forgotPassword,
  verifyResetCode,
  resetPassword
} = require('../controllers/authController');
const { validateSignup, checkValidation } = require('../middleware/validation');

// POST /api/auth/signup
router.post('/signup', validateSignup, (req, res) => {
  const validationError = checkValidation(req, res);
  if (validationError) {
    return validationError;
  }
  return signup(req, res);
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password, userType } = req.body;
  
  if (!email || !password || !userType) {
    return res.status(400).json({
      success: false,
      message: 'Email, password, and user type are required'
    });
  }
  
  return login(req, res);
});

// POST /api/auth/verify
router.post('/verify', (req, res) => {
  const { email, otpCode } = req.body;
  
  if (!email || !otpCode) {
    return res.status(400).json({
      success: false,
      message: 'Email and OTP code are required'
    });
  }
  
  return verifyEmail(req, res);
});

// POST /api/auth/resend-otp
router.post('/resend-otp', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required'
    });
  }
  
  return resendOTP(req, res);
});

// POST /api/auth/forgot-password - Step 1: Email only
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required'
    });
  }
  
  return forgotPassword(req, res);
});

// POST /api/auth/verify-reset-code - Step 2: OTP code only
router.post('/verify-reset-code', (req, res) => {
  const { otpCode } = req.body;
  
  if (!otpCode) {
    return res.status(400).json({
      success: false,
      message: 'OTP code is required'
    });
  }
  
  return verifyResetCode(req, res);
});

// POST /api/auth/reset-password - Step 3: Password and confirm password only (session from header)
router.post('/reset-password', (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  
  if (!newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password and confirm password are required'
    });
  }
  
  return resetPassword(req, res);
});

module.exports = router;