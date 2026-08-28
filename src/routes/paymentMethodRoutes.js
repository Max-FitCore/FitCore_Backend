const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const {
  addPaymentMethod,
  getPaymentMethods,
  getPaymentMethodById,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  updatePaymentMethod
} = require('../controllers/paymentMethodController');

// All routes require authentication
router.use(protect);

// Member only routes
router.post('/', addPaymentMethod);
router.get('/', getPaymentMethods);
router.get('/:id', getPaymentMethodById);
router.delete('/:id', deletePaymentMethod);
router.put('/:id/default', setDefaultPaymentMethod);
router.put('/:id', updatePaymentMethod);

module.exports = router;