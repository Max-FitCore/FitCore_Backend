const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Member ID is required']
  },
  cardNumber: {
    type: String,
    required: [true, 'Card number is required'],
    trim: true,
    select: false // Don't return by default for security
  },
  lastFourDigits: {
    type: String,
    required: true,
    trim: true
  },
  expiryDate: {
    type: String,
    required: [true, 'Expiry date is required'],
    trim: true,
    match: [/^(0[1-9]|1[0-2])\/([0-9]{2})$/, 'Expiry date must be in MM/YY format']
  },
  cvv: {
    type: String,
    required: [true, 'CVV is required'],
    trim: true,
    select: false // Don't return by default for security
  },
  nameOnCard: {
    type: String,
    required: [true, 'Name on card is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  cardType: {
    type: String,
    enum: ['Visa', 'Mastercard', 'Amex', 'Discover', 'Other'],
    default: 'Other'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Update updatedAt on save
paymentMethodSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

// Virtual for masked card number
paymentMethodSchema.virtual('maskedCardNumber').get(function() {
  return `**** **** **** ${this.lastFourDigits}`;
});

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);