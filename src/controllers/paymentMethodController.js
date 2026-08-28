const PaymentMethod = require('../models/PaymentMethod');

// Helper function to detect card type
const detectCardType = (cardNumber) => {
  const cleaned = cardNumber.replace(/\s/g, '');
  if (/^4/.test(cleaned)) return 'Visa';
  if (/^5[1-5]/.test(cleaned)) return 'Mastercard';
  if (/^3[47]/.test(cleaned)) return 'Amex';
  if (/^6(?:011|5)/.test(cleaned)) return 'Discover';
  return 'Other';
};

// @desc    Add a new payment method
// @route   POST /api/payment-methods
// @access  Private (Member only)
const addPaymentMethod = async (req, res) => {
  try {
    const { cardNumber, expiryDate, cvv, nameOnCard, isDefault } = req.body;
    const memberId = req.user._id;

    // Check if user is a member
    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can add payment methods'
      });
    }

    // Validate required fields
    if (!cardNumber || !expiryDate || !cvv || !nameOnCard) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: cardNumber, expiryDate, cvv, nameOnCard'
      });
    }

    // Validate card number (16 digits)
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    if (!/^\d{15,16}$/.test(cleanCardNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid card number. Must be 15-16 digits'
      });
    }

    // Validate expiry date (MM/YY)
    if (!/^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(expiryDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid expiry date. Format must be MM/YY'
      });
    }

    // Validate CVV
    if (!/^\d{3,4}$/.test(cvv)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid CVV. Must be 3-4 digits'
      });
    }

    // Validate name on card
    if (nameOnCard.length < 2 || nameOnCard.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Name on card must be between 2 and 100 characters'
      });
    }

    // Get last 4 digits
    const lastFourDigits = cleanCardNumber.slice(-4);
    const cardType = detectCardType(cleanCardNumber);

    // Check if this card already exists for this member
    const existingCard = await PaymentMethod.findOne({
      memberId,
      lastFourDigits,
      isActive: true
    });

    if (existingCard) {
      return res.status(400).json({
        success: false,
        message: 'This card is already added to your account'
      });
    }

    // If this is the first card, make it default
    const cardCount = await PaymentMethod.countDocuments({ 
      memberId, 
      isActive: true 
    });
    const shouldBeDefault = cardCount === 0 ? true : (isDefault || false);

    // If setting as default, remove default from other cards
    if (shouldBeDefault) {
      await PaymentMethod.updateMany(
        { memberId, isActive: true },
        { isDefault: false }
      );
    }

    // Create payment method
    const paymentMethod = await PaymentMethod.create({
      memberId,
      cardNumber: cleanCardNumber,
      lastFourDigits,
      expiryDate,
      cvv,
      nameOnCard,
      cardType,
      isDefault: shouldBeDefault
    });

    // Return without sensitive data
    const responseData = {
      _id: paymentMethod._id,
      lastFourDigits: paymentMethod.lastFourDigits,
      expiryDate: paymentMethod.expiryDate,
      nameOnCard: paymentMethod.nameOnCard,
      cardType: paymentMethod.cardType,
      isDefault: paymentMethod.isDefault,
      maskedCardNumber: paymentMethod.maskedCardNumber,
      createdAt: paymentMethod.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'Payment method added successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Add payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding payment method',
      error: error.message
    });
  }
};

// @desc    Get all payment methods for a member
// @route   GET /api/payment-methods
// @access  Private (Member only)
const getPaymentMethods = async (req, res) => {
  try {
    const memberId = req.user._id;

    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can view payment methods'
      });
    }

    const paymentMethods = await PaymentMethod.find({
      memberId,
      isActive: true
    }).select('-cardNumber -cvv');

    res.status(200).json({
      success: true,
      count: paymentMethods.length,
      data: paymentMethods
    });

  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment methods',
      error: error.message
    });
  }
};

// @desc    Get a single payment method
// @route   GET /api/payment-methods/:id
// @access  Private (Member only)
const getPaymentMethodById = async (req, res) => {
  try {
    const { id } = req.params;
    const memberId = req.user._id;

    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can view payment methods'
      });
    }

    const paymentMethod = await PaymentMethod.findOne({
      _id: id,
      memberId,
      isActive: true
    }).select('-cardNumber -cvv');

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    res.status(200).json({
      success: true,
      data: paymentMethod
    });

  } catch (error) {
    console.error('Get payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment method',
      error: error.message
    });
  }
};

// @desc    Delete a payment method (soft delete)
// @route   DELETE /api/payment-methods/:id
// @access  Private (Member only)
const deletePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const memberId = req.user._id;

    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can delete payment methods'
      });
    }

    const paymentMethod = await PaymentMethod.findOne({
      _id: id,
      memberId,
      isActive: true
    });

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    const cardInfo = {
      lastFourDigits: paymentMethod.lastFourDigits,
      cardType: paymentMethod.cardType,
      nameOnCard: paymentMethod.nameOnCard
    };

    // Soft delete
    paymentMethod.isActive = false;
    await paymentMethod.save();

    // If this was the default card, set another card as default
    if (paymentMethod.isDefault) {
      const anotherCard = await PaymentMethod.findOne({
        memberId,
        isActive: true,
        _id: { $ne: id }
      });

      if (anotherCard) {
        anotherCard.isDefault = true;
        await anotherCard.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Payment method removed successfully',
      data: {
        lastFourDigits: cardInfo.lastFourDigits,
        cardType: cardInfo.cardType,
        nameOnCard: cardInfo.nameOnCard,
        wasDefault: paymentMethod.isDefault
      }
    });

  } catch (error) {
    console.error('Delete payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting payment method',
      error: error.message
    });
  }
};

// @desc    Set a payment method as default
// @route   PUT /api/payment-methods/:id/default
// @access  Private (Member only)
const setDefaultPaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const memberId = req.user._id;

    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can update payment methods'
      });
    }

    const paymentMethod = await PaymentMethod.findOne({
      _id: id,
      memberId,
      isActive: true
    });

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    // Remove default from all other cards
    await PaymentMethod.updateMany(
      { memberId, isActive: true },
      { isDefault: false }
    );

    // Set this card as default
    paymentMethod.isDefault = true;
    await paymentMethod.save();

    res.status(200).json({
      success: true,
      message: 'Default payment method updated successfully',
      data: {
        _id: paymentMethod._id,
        lastFourDigits: paymentMethod.lastFourDigits,
        cardType: paymentMethod.cardType,
        isDefault: paymentMethod.isDefault
      }
    });

  } catch (error) {
    console.error('Set default payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting default payment method',
      error: error.message
    });
  }
};

// @desc    Update a payment method
// @route   PUT /api/payment-methods/:id
// @access  Private (Member only)
const updatePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const { expiryDate, nameOnCard } = req.body;
    const memberId = req.user._id;

    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'Only members can update payment methods'
      });
    }

    const paymentMethod = await PaymentMethod.findOne({
      _id: id,
      memberId,
      isActive: true
    });

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    const updateData = {};

    if (expiryDate !== undefined) {
      if (!/^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(expiryDate)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid expiry date. Format must be MM/YY'
        });
      }
      updateData.expiryDate = expiryDate;
    }

    if (nameOnCard !== undefined) {
      if (nameOnCard.length < 2 || nameOnCard.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Name on card must be between 2 and 100 characters'
        });
      }
      updateData.nameOnCard = nameOnCard;
    }

    const updatedPaymentMethod = await PaymentMethod.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).select('-cardNumber -cvv');

    res.status(200).json({
      success: true,
      message: 'Payment method updated successfully',
      data: updatedPaymentMethod
    });

  } catch (error) {
    console.error('Update payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating payment method',
      error: error.message
    });
  }
};

module.exports = {
  addPaymentMethod,
  getPaymentMethods,
  getPaymentMethodById,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  updatePaymentMethod
};