const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const {
  // Trainer management
  getAllTrainers,
  getTrainerById,
  addTrainer,
  deleteTrainer,
  updateTrainer,
  // Member management
  getAllMembers,
  getMemberById,
  addMember,
  deleteMember,
  updateMember,
  // Class management
  getAllClasses,
  getClassById,
  addClass,
  updateClass,
  deleteClass,
  getClassStats,
  // Dashboard
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

// Member management
router.get('/members', getAllMembers);
router.get('/members/:id', getMemberById);
router.post('/members/add', addMember);
router.put('/members/:id', updateMember);
router.delete('/members/:id', deleteMember);

// Class management
router.get('/classes', getAllClasses);
router.get('/classes/stats/overview', getClassStats);
router.get('/classes/:id', getClassById);
router.post('/classes/add', addClass);
router.put('/classes/:id', updateClass);
router.delete('/classes/:id', deleteClass);

module.exports = router;