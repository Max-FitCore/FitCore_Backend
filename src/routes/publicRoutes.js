const express = require('express');
const router = express.Router();

const {
  getAllMembersPublic,
  getMemberByIdPublic,
  getAllTrainersPublic,
  getTrainerByIdPublic,
  getGymInfo
} = require('../controllers/publicController');

const {
  getAllMembershipPlansPublic
} = require('../controllers/membershipPlanController');

// ===== Members =====
router.get('/members', getAllMembersPublic);
router.get('/members/:id', getMemberByIdPublic);

// ===== Trainers =====
router.get('/trainers', getAllTrainersPublic);
router.get('/trainers/:id', getTrainerByIdPublic);

// ===== Gym Info =====
router.get('/gym-info', getGymInfo);

// ===== Membership Plans (public) =====
router.get('/membership-plans', getAllMembershipPlansPublic);

module.exports = router;