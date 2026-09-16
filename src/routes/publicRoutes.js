const express = require('express');
const router = express.Router();
const {
  getAllMembersPublic,
  getMemberByIdPublic,
  getAllTrainersPublic,
  getTrainerByIdPublic,
  getGymInfo
} = require('../controllers/publicController');

// All routes are public (no authentication required)

// Members
router.get('/members', getAllMembersPublic);
router.get('/members/:id', getMemberByIdPublic);

// Trainers
router.get('/trainers', getAllTrainersPublic);
router.get('/trainers/:id', getTrainerByIdPublic);

// Gym Info
router.get('/gym-info', getGymInfo);

module.exports = router;