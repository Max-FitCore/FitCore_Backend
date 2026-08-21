const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { generateOTP, sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @desc    Register a new member
// @route   POST /api/auth/signup
// @access  Public
const signup = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    const user = await User.create({
      fullName,
      email,
      password,
      role: 'member',
      isVerified: false
    });

    const otpCode = generateOTP();
    
    await OTP.create({
      userId: user._id,
      code: otpCode,
      type: 'verification',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    await sendVerificationEmail(email, fullName, otpCode);

    const token = generateToken(user._id);
    user.password = undefined;

    res.status(201).json({
      success: true,
      message: 'Member registered successfully. Please verify your email.',
      data: {
        user,
        token,
        requiresVerification: true
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating account',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password, userType } = req.body;

    if (!email || !password || !userType) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and user type are required'
      });
    }

    const validRoles = ['member', 'trainer', 'administrator'];
    if (!validRoles.includes(userType.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type. Must be member, trainer, or administrator'
      });
    }

    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    if (user.role !== userType.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: `Invalid credentials for ${userType} account`
      });
    }

    if (user.role === 'member' && !user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in',
        requiresVerification: true,
        email: user.email
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);
    user.password = undefined;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};

// @desc    Step 1: Request password reset (send OTP)
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email'
      });
    }

    // Delete any existing unused password reset OTPs for this user
    await OTP.deleteMany({
      userId: user._id,
      type: 'password_reset',
      isUsed: false
    });

    // Generate new OTP
    const otpCode = generateOTP();
    
    // Save new OTP
    await OTP.create({
      userId: user._id,
      code: otpCode,
      type: 'password_reset',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    // Send password reset email
    await sendPasswordResetEmail(email, user.fullName, otpCode);

    res.status(200).json({
      success: true,
      message: 'Password reset code sent to your email',
      data: {
        email: user.email,
        expiresIn: '10 minutes'
      }
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending password reset code',
      error: error.message
    });
  }
};

// @desc    Step 2: Verify reset code (OTP only)
// @route   POST /api/auth/verify-reset-code
// @access  Public
const verifyResetCode = async (req, res) => {
  try {
    const { otpCode } = req.body;

    if (!otpCode) {
      return res.status(400).json({
        success: false,
        message: 'OTP code is required'
      });
    }

    // Find the password reset OTP
    const otpRecord = await OTP.findOne({
      code: otpCode,
      type: 'password_reset',
      isUsed: false
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code'
      });
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Reset code has expired. Please request a new one.'
      });
    }

    // Find the user
    const user = await User.findById(otpRecord.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Generate session token for password reset
    const sessionId = jwt.sign(
      { id: user._id, email: user.email, purpose: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    res.status(200).json({
      success: true,
      message: 'Reset code verified successfully',
      data: {
        sessionId,
        expiresIn: '5 minutes'
      }
    });

  } catch (error) {
    console.error('Verify reset code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying reset code',
      error: error.message
    });
  }
};

// @desc    Step 3: Reset password (session from auth header)
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password are required'
      });
    }

    // Get session ID from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Session token is required. Please verify your code first.'
      });
    }

    const sessionId = authHeader.split(' ')[1];

    // Verify the session
    let decoded;
    try {
      decoded = jwt.verify(sessionId, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired session. Please verify your code again.'
      });
    }

    // Check if token is for password reset
    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({
        success: false,
        message: 'Invalid session purpose'
      });
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Validate password strength
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

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Set new password - the pre('save') hook will hash it
    user.password = newPassword;
    await user.save();

    // Generate new auth token
    const authToken = generateToken(user._id);
    
    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      data: {
        user: userResponse,
        token: authToken
      }
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};

// @desc    Verify email with OTP
// @route   POST /api/auth/verify
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP code are required'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Account is already verified'
      });
    }

    const otpRecord = await OTP.findOne({
      userId: user._id,
      code: otpCode,
      type: 'verification',
      isUsed: false
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP code'
      });
    }

    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'OTP code has expired. Please request a new one.'
      });
    }

    otpRecord.isUsed = true;
    await otpRecord.save();

    user.isVerified = true;
    await user.save();

    const token = generateToken(user._id);
    user.password = undefined;

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user,
        token
      }
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying email',
      error: error.message
    });
  }
};

// @desc    Resend verification OTP
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Account is already verified'
      });
    }

    await OTP.deleteMany({
      userId: user._id,
      type: 'verification',
      isUsed: false
    });

    const otpCode = generateOTP();
    
    await OTP.create({
      userId: user._id,
      code: otpCode,
      type: 'verification',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    await sendVerificationEmail(email, user.fullName, otpCode);

    res.status(200).json({
      success: true,
      message: 'New verification code sent to your email'
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resending verification code',
      error: error.message
    });
  }
};

module.exports = {
  signup,
  login,
  verifyEmail,
  resendOTP,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  generateToken
};