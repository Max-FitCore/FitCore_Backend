const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification email
const sendVerificationEmail = async (email, fullName, otpCode) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"FitCore" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your FitCore Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 10px;">
          <div style="background: #2d3748; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">🏋️ FitCore</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #2d3748;">Hello ${fullName},</h2>
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
              Thank you for signing up for FitCore! Please verify your email address by entering the code below:
            </p>
            
            <div style="background: #ebf8ff; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <h2 style="color: #2b6cb0; font-size: 32px; letter-spacing: 8px; margin: 0;">${otpCode}</h2>
            </div>
            
            <p style="color: #4a5568; font-size: 14px;">
              This code will expire in <strong>10 minutes</strong>.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            
            <p style="color: #718096; font-size: 12px; text-align: center;">
              If you didn't request this, please ignore this email.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;

  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send verification email');
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, fullName, otpCode) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"FitCore" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Your FitCore Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 10px;">
          <div style="background: #e53e3e; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">🔐 FitCore</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #2d3748;">Hello ${fullName},</h2>
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
              We received a request to reset your password. Use the code below to reset your password:
            </p>
            
            <div style="background: #fff5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px solid #fc8181;">
              <h2 style="color: #e53e3e; font-size: 32px; letter-spacing: 8px; margin: 0;">${otpCode}</h2>
            </div>
            
            <p style="color: #4a5568; font-size: 14px;">
              This code will expire in <strong>10 minutes</strong>.
            </p>
            
            <p style="color: #718096; font-size: 14px; margin-top: 20px;">
              If you didn't request a password reset, please ignore this email and your password will remain unchanged.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            
            <p style="color: #718096; font-size: 12px; text-align: center;">
              For security reasons, never share this code with anyone.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;

  } catch (error) {
    console.error('Password reset email error:', error);
    throw new Error('Failed to send password reset email');
  }
};

module.exports = {
  generateOTP,
  sendVerificationEmail,
  sendPasswordResetEmail
};