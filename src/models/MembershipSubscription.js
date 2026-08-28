const mongoose = require('mongoose');

const membershipSubscriptionSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Member ID is required']
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPlan',
    required: [true, 'Plan ID is required']
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'pending'],
    default: 'pending'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    default: Date.now
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required']
  },
  discountApplied: {
    type: Number,
    default: 0
  },
  finalPrice: {
    type: Number,
    required: [true, 'Final price is required']
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'cash', 'bank_transfer'],
    default: 'credit_card'
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'failed'],
    default: 'pending'
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancellationReason: {
    type: String,
    trim: true,
    default: null
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
membershipSubscriptionSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

// Virtual for days remaining
membershipSubscriptionSchema.virtual('daysRemaining').get(function() {
  if (this.status === 'cancelled' || this.status === 'expired') return 0;
  const now = new Date();
  const diff = this.endDate - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Virtual for isExpired
membershipSubscriptionSchema.virtual('isExpired').get(function() {
  return new Date() > this.endDate && this.status !== 'cancelled';
});

module.exports = mongoose.model('MembershipSubscription', membershipSubscriptionSchema);