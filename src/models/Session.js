const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  trainerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Trainer ID is required']
  },
  day: {
    type: String,
    required: [true, 'Day is required'],
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  time: {
    type: String,
    required: [true, 'Time is required'],
    trim: true
  },
  sessionName: {
    type: String,
    required: [true, 'Session name is required'],
    trim: true,
    minlength: [3, 'Session name must be at least 3 characters'],
    maxlength: [100, 'Session name cannot exceed 100 characters']
  },
  difficulty: {
    type: String,
    required: [true, 'Difficulty is required'],
    enum: ['Beginner', 'Intermediate', 'Advanced']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: null
  },
  maxParticipants: {
    type: Number,
    default: 20,
    min: [1, 'Max participants must be at least 1']
  },
  currentParticipants: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number, // in minutes
    default: 60,
    min: [15, 'Duration must be at least 15 minutes'],
    max: [180, 'Duration cannot exceed 180 minutes']
  },
  location: {
    type: String,
    trim: true,
    default: 'Gym Main Floor'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFull: {
    type: Boolean,
    default: false
  },
  bookedMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
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
sessionSchema.pre('save', function() {
  this.updatedAt = Date.now();
  // Auto-set isFull if current participants reach max
  if (this.currentParticipants >= this.maxParticipants) {
    this.isFull = true;
  } else {
    this.isFull = false;
  }
});

// Virtual for available spots
sessionSchema.virtual('availableSpots').get(function() {
  return this.maxParticipants - this.currentParticipants;
});

module.exports = mongoose.model('Session', sessionSchema);