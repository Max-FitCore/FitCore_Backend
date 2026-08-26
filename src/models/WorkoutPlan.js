const mongoose = require('mongoose');

const workoutDaySchema = new mongoose.Schema({
  day: {
    type: String,
    required: [true, 'Day is required'],
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  focus: {
    type: String,
    required: [true, 'Focus area is required'],
    trim: true
  },
  exercises: [{
    type: String,
    required: [true, 'Exercise name is required'],
    trim: true
  }]
});

const workoutPlanSchema = new mongoose.Schema({
  trainerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Trainer ID is required']
  },
  planName: {
    type: String,
    required: [true, 'Plan name is required'],
    trim: true,
    minlength: [3, 'Plan name must be at least 3 characters'],
    maxlength: [100, 'Plan name cannot exceed 100 characters']
  },
  planType: {
    type: String,
    required: [true, 'Plan type is required'],
    enum: ['Strength', 'Cardio', 'Flexibility', 'Cross Training', 'HIIT', 'Yoga', 'Pilates']
  },
  planLevel: {
    type: String,
    required: [true, 'Plan level is required'],
    enum: ['Beginner', 'Intermediate', 'Advanced', 'All Levels']
  },
  totalSessions: {
    type: Number,
    required: [true, 'Total sessions is required'],
    min: [1, 'Total sessions must be at least 1']
  },
  sessionsPerWeek: {
    type: Number,
    required: [true, 'Sessions per week is required'],
    min: [1, 'Sessions per week must be at least 1'],
    max: [7, 'Sessions per week cannot exceed 7']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: null
  },
  planIcon: {
    type: String,
    required: [true, 'Plan icon is required'],
    enum: ['💪', '🔥', '🧘', '⚡', '🏋️', '🚴', '💃', '🥊', '🏃', '🧗'],
    default: '💪'
  },
  workoutDays: [workoutDaySchema],
  isActive: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  assignedMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalRatings: {
    type: Number,
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
workoutPlanSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

// Virtual for total exercises count
workoutPlanSchema.virtual('totalExercises').get(function() {
  let count = 0;
  this.workoutDays.forEach(day => {
    count += day.exercises.length;
  });
  return count;
});

module.exports = mongoose.model('WorkoutPlan', workoutPlanSchema);