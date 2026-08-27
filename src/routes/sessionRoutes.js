const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const {
  createSession,
  getMySessions,
  getSessionById,
  updateSession,
  deleteSession,
  bookSession,
  cancelBooking,
  getAvailableSessions,
  getMyBookings,
  getSessionParticipants
} = require('../controllers/sessionController');

// All routes require authentication
router.use(protect);

// Trainer routes
router.post('/create', createSession);
router.get('/my-sessions', getMySessions);
router.get('/:id/participants', getSessionParticipants);

// Member routes
router.get('/available', getAvailableSessions);
router.get('/my-bookings', getMyBookings);
router.post('/:id/book', bookSession);
router.delete('/:id/cancel', cancelBooking);

// General routes (with access control)
router.get('/:id', getSessionById);
router.put('/:id', updateSession);
router.delete('/:id', deleteSession);

module.exports = router;