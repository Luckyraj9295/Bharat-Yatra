const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const auth = require('../middleware/auth');

const router = express.Router();

// Validate Razorpay credentials on startup
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('⚠️ WARNING: Razorpay credentials not configured!');
  console.error('Missing:', {
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ? '✅ Set' : '❌ Missing',
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ? '✅ Set' : '❌ Missing'
  });
}

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ✅ CREATE RAZORPAY ORDER
router.post('/create-order', auth, async (req, res) => {
  try {
    const { bookingId, amount } = req.body;

    // Validate input
    if (!bookingId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and amount are required'
      });
    }

    // Verify booking exists and belongs to user
    const booking = await Booking.findOne({
      _id: bookingId,
      user: req.user.userId
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or unauthorized'
      });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Amount in smallest unit (paise)
      currency: 'INR',
      receipt: `bk${Date.now()}_${bookingId.toString().slice(-8)}`, // Max 40 chars
      notes: {
        bookingId: bookingId.toString(),
        userId: req.user.userId
      }
    };

    console.log('📝 Creating Razorpay order with options:', {
      amount: options.amount,
      currency: options.currency,
      receipt: options.receipt
    });

    const razorpayOrder = await razorpay.orders.create(options);

    // Save payment record to DB
    const payment = new Payment({
      booking: bookingId,
      user: req.user.userId,
      razorpayOrderId: razorpayOrder.id,
      amount: amount,
      status: 'pending'
    });

    await payment.save();

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId: razorpayOrder.id,
        amount: amount,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID
      }
    });

  } catch (error) {
    console.error('❌ Order creation error:', error.message);
    console.error('Error details:', {
      message: error.message,
      statusCode: error.statusCode,
      error: error.error
    });
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
});

// ✅ VERIFY RAZORPAY PAYMENT
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body;

    // Validate input
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification details'
      });
    }

    // Generate signature to verify payment
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isSignatureValid = expectedSignature === razorpaySignature;

    if (!isSignatureValid) {
      // Update payment status to failed
      await Payment.findOneAndUpdate(
        { razorpayOrderId },
        {
          status: 'failed',
          failureReason: 'Invalid signature'
        }
      );

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // 🔍 Fetch payment details from Razorpay API to get the actual payment method
    let paymentMethod = 'unknown';
    try {
      const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
      const paymentDetailsRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpayPaymentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });

      if (paymentDetailsRes.ok) {
        const paymentDetails = await paymentDetailsRes.json();
        // Map Razorpay method names to our enum values
        const methodMap = {
          'card': 'card',
          'netbanking': 'netbanking',
          'wallet': 'wallet',
          'upi': 'upi',
          'emandate': 'card',
          'emi': 'card'
        };
        paymentMethod = methodMap[paymentDetails.method] || 'unknown';
        console.log('💳 Payment method from Razorpay:', paymentDetails.method, '→', paymentMethod);
      } else {
        console.warn('⚠️ Could not fetch payment details from Razorpay:', paymentDetailsRes.status);
      }
    } catch (err) {
      console.warn('⚠️ Error fetching payment details from Razorpay:', err.message);
    }

    // Update payment record with successful details
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId },
      {
        razorpayPaymentId,
        razorpaySignature,
        status: 'completed',
        completedAt: new Date(),
        paymentMethod: paymentMethod
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    // Update booking with Razorpay payment details including actual payment method
    const updatedBooking = await Booking.findByIdAndUpdate(
      payment.booking,
      { 
        paymentStatus: 'completed',
        razorpayPaymentId: razorpayPaymentId,
        razorpayOrderId: razorpayOrderId,
        paymentMethod: paymentMethod,
        paymentCompletedAt: new Date()
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        paymentId: payment._id,
        status: payment.status,
        amount: payment.amount,
        razorpayPaymentId: razorpayPaymentId,
        paymentMethod: paymentMethod
      }
    });

  } catch (error) {
    console.error('❌ Verification error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
});

// ✅ PROCESS REFUND FOR CANCELLED BOOKING
router.post('/refund', auth, async (req, res) => {
  try {
    const { bookingId, cancellationReason } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    // Find booking
    const booking = await Booking.findOne({
      _id: bookingId,
      user: req.user.userId
    }).populate('destination');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or unauthorized'
      });
    }

    // Check if already cancelled
    if (booking.bookingStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    // Calculate refund based on cancellation policy
    const travelDate = new Date(booking.travelDate);
    const today = new Date();
    const daysUntilTravel = Math.ceil((travelDate - today) / (1000 * 60 * 60 * 24));

    let refundPercentage = 0;
    let refundReason = '';

    if (daysUntilTravel > 14) {
      refundPercentage = 100;
      refundReason = 'Full refund: Cancelled more than 14 days before travel';
    } else if (daysUntilTravel >= 7) {
      refundPercentage = 50;
      refundReason = 'Partial refund (50%): Cancelled 7-14 days before travel';
    } else {
      refundPercentage = 0;
      refundReason = 'No refund: Cancelled less than 7 days before travel (non-refundable)';
    }

    const refundAmount = (booking.totalPrice * refundPercentage) / 100;

    console.log('💰 Refund Calculation:', {
      bookingRef: booking.bookingRef,
      totalPrice: booking.totalPrice,
      daysUntilTravel,
      refundPercentage,
      refundAmount
    });

    // Find payment record
    const payment = await Payment.findOne({
      razorpayPaymentId: booking.razorpayPaymentId
    });

    if (!payment || !booking.razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        message: 'No payment found for this booking'
      });
    }

    // Process Razorpay refund if refund amount > 0
    let razorpayRefundId = null;
    if (refundAmount > 0) {
      try {
        const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
        const refundRes = await fetch(`https://api.razorpay.com/v1/payments/${booking.razorpayPaymentId}/refund`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: Math.round(refundAmount * 100) // Convert to paise
          })
        });

        if (!refundRes.ok) {
          const errorData = await refundRes.json();
          throw new Error(`Razorpay refund failed: ${errorData.error?.description || 'Unknown error'}`);
        }

        const refundData = await refundRes.json();
        razorpayRefundId = refundData.id;

        console.log('✅ Razorpay refund processed:', razorpayRefundId);
      } catch (err) {
        console.error('❌ Razorpay refund error:', err.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to process refund',
          error: err.message
        });
      }
    }

    // Update booking with cancellation and refund details
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        bookingStatus: 'cancelled',
        cancellationReason: cancellationReason || 'User requested cancellation',
        cancellationRequestedAt: new Date(),
        refundStatus: refundAmount > 0 ? 'completed' : 'none',
        refundAmount: refundAmount,
        refundPercentage: refundPercentage,
        refundReason: refundReason,
        razorpayRefundId: razorpayRefundId,
        refundCompletedAt: refundAmount > 0 ? new Date() : null
      },
      { new: true }
    );

    // 📧 TODO: Send refund confirmation email to user
    // const User = require('../models/User');
    // const user = await User.findById(booking.user);
    // if (user && user.email) {
    //   await sendRefundNotificationEmail(user.email, {
    //     bookingRef: updatedBooking.bookingRef,
    //     refundAmount,
    //     refundReason,
    //     guestEmail: booking.personalInfo.email
    //   });
    // }

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        bookingRef: updatedBooking.bookingRef,
        refundAmount,
        refundPercentage,
        refundReason,
        refundStatus: updatedBooking.refundStatus,
        razorpayRefundId
      }
    });

  } catch (error) {
    console.error('❌ Refund error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Refund processing failed',
      error: error.message
    });
  }
});

// ✅ GET PAYMENT DETAILS
router.get('/details/:orderId', auth, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      razorpayOrderId: req.params.orderId,
      user: req.user.userId
    }).populate('booking');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('❌ Error fetching payment:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details',
      error: error.message
    });
  }
});

module.exports = router;
