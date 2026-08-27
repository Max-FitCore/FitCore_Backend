const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const {
  getAllTrainers,
  getTrainerById,
  addTrainer,
  deleteTrainer,
  updateTrainer,
  getDashboardStats
} = require('../controllers/adminController');

// All admin routes require authentication
router.use(protect);

// Dashboard
router.get('/dashboard', getDashboardStats);

// Trainer management
router.get('/trainers', getAllTrainers);
router.get('/trainers/:id', getTrainerById);
router.post('/trainers/add', addTrainer);
router.put('/trainers/:id', updateTrainer);
router.delete('/trainers/:id', deleteTrainer);

module.exports = router;