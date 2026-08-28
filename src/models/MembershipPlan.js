const mongoose = require('mongoose');

const membershipPlanSchema = new mongoose.Schema({
  planName: {
    type: String,
    required: [true, 'Plan name is required'],
    trim: true,
    unique: true,
    minlength: [3, 'Plan name must be at least 3 characters'],
    maxlength: [100, 'Plan name cannot exceed 100 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  features: [{
    type: String,
    required: [true, 'Features are required'],
    trim: true,
    minlength: [2, 'Each feature must be at least 2 characters']
  }],
  duration: {
    type: String,
    enum: ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'],
    default: 'Monthly'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  discount: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
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
membershipPlanSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

// Virtual for discounted price
membershipPlanSchema.virtual('discountedPrice').get(function() {
  if (this.discount > 0) {
    return this.price - (this.price * (this.discount / 100));
  }
  return this.price;
});

module.exports = mongoose.model('MembershipPlan', membershipPlanSchema);