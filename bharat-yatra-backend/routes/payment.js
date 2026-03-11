const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { Resend } = require('resend');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const User = require('../models/User');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

const router = express.Router();

// Initialize Resend for email notifications
const resend = new Resend(process.env.RESEND_API_KEY);
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Bharat Yaatra <onboarding@resend.dev>';

// Prefer booking personal email, then linked user email
const resolveBookingEmail = (booking) =>
  booking?.personalInfo?.email || booking?.user?.email || booking?.userId?.email || null;

const getUserProfileContact = async (userId) => {
  if (!userId) return null;
  return User.findById(userId).select('email name').lean();
};

if (process.env.RESEND_API_KEY && !process.env.RESEND_FROM_EMAIL) {
  console.warn('⚠️ RESEND_FROM_EMAIL is not set. Using onboarding@resend.dev may restrict delivery to unverified recipients.');
}

// Validate and initialize Razorpay conditionally
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
  console.log('✅ Razorpay Payment Gateway configured');
} else {
  console.warn('⚠️  WARNING: Razorpay credentials not configured!');
  console.warn('Missing:', {
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ? '✅ Set' : '❌ Missing',
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ? '✅ Set' : '❌ Missing'
  });
}

// ✅ CREATE RAZORPAY ORDER
router.post('/create-order', auth, async (req, res) => {
  // Check if Razorpay is configured
  if (!razorpay) {
    return res.status(503).json({
      success: false,
      message: 'Payment service not available. Razorpay not configured.'
    });
  }

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

    // ✅ PREVENT RE-CREATION: Don't create new order if payment already completed
    if (booking.paymentStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Payment already completed for this booking. Cannot create a new order.'
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

    console.log('🔐 Razorpay credentials check:', {
      hasKeyId: !!process.env.RAZORPAY_KEY_ID,
      hasKeySecret: !!process.env.RAZORPAY_KEY_SECRET,
      ...(process.env.NODE_ENV === 'development' && {
        keyIdPrefix: process.env.RAZORPAY_KEY_ID?.substring(0, 8) + '...'
      })
    });

    const razorpayOrder = await razorpay.orders.create(options);
    
    console.log('✅ Razorpay order created successfully:', {
      orderId: razorpayOrder.id,
      status: razorpayOrder.status
    });

    // Save payment record to DB
    const payment = new Payment({
      booking: bookingId,
      user: req.user.userId,
      razorpayOrderId: razorpayOrder.id,
      amount: amount,
      status: 'pending'
    });

    await payment.save();
    console.log('💾 Payment record saved to DB:', payment._id);

    const responseData = {
      orderId: razorpayOrder.id,
      amount: amount,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID
    };

    console.log('📤 Sending response to frontend:', {
      success: true,
      data: {
        orderId: responseData.orderId,
        amount: responseData.amount,
        keyIdPresent: !!responseData.keyId,
        keyIdPrefix: responseData.keyId?.substring(0, 8) + '...'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: responseData
    });

  } catch (error) {
    console.error('❌ Order creation FAILED:', error.message);
    console.error('Full error details:', {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      stack: error.stack?.split('\n')[0],
      razorpayError: error.error
    });
    
    // Check if it's a Razorpay auth error
    if (error.statusCode === 401 || error.code === 'UNAUTHORIZED') {
      console.error('🔴 CRITICAL: Razorpay authentication failed! Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
      return res.status(401).json({
        success: false,
        message: 'Razorpay authentication failed. Invalid API credentials.',
        error: 'Invalid Razorpay credentials'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: error.message,
      debug: process.env.NODE_ENV === 'development' ? error.statusCode : undefined
    });
  }
});

// ✅ VERIFY RAZORPAY PAYMENT
router.post('/verify-payment', auth, async (req, res) => {
  try {
    // Check if Razorpay is configured
    if (!process.env.RAZORPAY_KEY_SECRET || !process.env.RAZORPAY_KEY_ID) {
      return res.status(503).json({
        success: false,
        message: 'Payment service not configured. Razorpay credentials missing.'
      });
    }

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body;

    // Validate input
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification details'
      });
    }

    // ✅ FIRST: Fetch payment WITHOUT updating
    const payment = await Payment.findOne({ razorpayOrderId });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    // ✅ IDEMPOTENCY CHECK (FIRST): If already completed, return success immediately (safe to retry)
    if (payment.status === 'completed') {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        data: {
          paymentId: payment._id,
          status: payment.status,
          amount: payment.amount,
          razorpayPaymentId: payment.razorpayPaymentId
        }
      });
    }

    // ✅ SECURITY CHECK: Verify payment belongs to logged-in user
    if (payment.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Payment does not belong to your account'
      });
    }

    // ✅ INTEGRITY CHECK: Verify booking ID matches payment record
    if (payment.booking.toString() !== bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID mismatch: Payment does not match the requested booking'
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
      const razorpayAuthHeader = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
      const paymentDetailsRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpayPaymentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${razorpayAuthHeader}`,
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

    // ✅ NOW UPDATE: After all checks pass, update payment record with successful details
    const updatedPayment = await Payment.findOneAndUpdate(
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
    ).populate('destination');

    // 🔕 Booking confirmation notification disabled by request

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        paymentId: updatedPayment._id,
        status: updatedPayment.status,
        amount: updatedPayment.amount,
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

// ✅ HANDLE PAYMENT FAILURE / CANCELLATION
router.post('/payment-failed', auth, async (req, res) => {
  try {
    const { bookingId, reason = 'Payment cancelled or failed' } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    // Verify booking exists and belongs to user
    const booking = await Booking.findOne({
      _id: bookingId,
      user: req.user.userId
    })
      .populate('destination')
      .populate('user', 'email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or unauthorized'
      });
    }

    // Update payment status to failed (prevent race condition: don't overwrite completed)
    await Payment.findOneAndUpdate(
      { booking: bookingId, status: { $ne: 'completed' } },
      { status: 'failed' }
    );

    // 🔕 Payment failure notification disabled by request
    const emailDispatched = false;

    console.log('⚠️ Payment failed for booking:', booking.bookingRef, 'Reason:', reason);

    res.status(200).json({
      success: true,
      message: 'Payment failure recorded. Please try again or contact support.',
      data: {
        bookingRef: booking.bookingRef,
        emailDispatched,
        nextSteps: 'You can retry payment anytime from your booking.'
      }
    });

  } catch (error) {
    console.error('❌ Payment failure handling error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to handle payment failure',
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
    })
      .populate('destination')
      .populate('user', 'email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or unauthorized'
      });
    }

    // ⚠️ Check payment status - must be completed to cancel
    if (booking.paymentStatus !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking. Payment status: ${booking.paymentStatus}. Only paid bookings can be cancelled.`
      });
    }

    // ✅ Verify Razorpay Payment ID exists (required for refund)
    if (!booking.razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        message: '⚠️ Cannot cancel: Razorpay payment reference not found. Contact support.'
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

    // DO NOT process Razorpay refund automatically
    // Wait for admin approval first
    // Refund will be processed in the admin approval endpoint

    // Update booking with cancellation details (refund marked as PENDING)
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        bookingStatus: 'cancelled',
        cancellationReason: cancellationReason || 'User requested cancellation',
        cancellationRequestedAt: new Date(),
        refundStatus: refundAmount > 0 ? 'pending' : 'none', // Mark as PENDING for admin approval
        refundAmount: refundAmount,
        refundPercentage: refundPercentage,
        refundReason: refundReason,
        razorpayRefundId: null // Will be set after admin approval
      },
      { new: true }
    );

    // 🔕 Cancellation confirmation notification disabled by request

    // ✅ Send notification to admins for refund approval
    console.log('⏳ Refund Pending Admin Approval:', {
      bookingRef: updatedBooking.bookingRef,
      refundAmount,
      refundPercentage,
      status: 'PENDING'
    });

    res.status(200).json({
      success: true,
      message: 'Cancellation request submitted. Awaiting admin approval for refund.',
      data: {
        bookingRef: updatedBooking.bookingRef,
        refundAmount,
        refundPercentage,
        refundReason,
        refundStatus: 'pending',
        estimatedRefundTime: '1-2 business days after admin approval'
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

// ✅ EMAIL HELPER: Send refund approved notification



const sendPaymentFailedEmail = async (userEmail, details) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ Resend API key not configured - cannot send payment failed email');
    return;
  }

  try {
    await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: userEmail,
      subject: `Payment Failed - Retry Your Booking ${details.bookingRef}`,
      html: `
        <div style="font-family: Arial, sans-serif; background: #fef2f2; padding: 20px; min-height: 100vh;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.15);">
            <!-- Header with warning -->
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 32px 24px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
              <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Payment Could Not Be Processed</h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">But don't worry, your booking is still reserved</p>
            </div>

            <!-- Main Content -->
            <div style="padding: 32px 24px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Dear ${details.name || userEmail.split('@')[0]},<br/>
                We were unable to process your payment for your Bharat Yaatra booking. This could be due to:
              </p>

              <!-- Reasons -->
              <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                <ul style="margin: 0; padding-left: 20px; color: #7f1d1d; font-size: 14px; line-height: 1.8;">
                  <li>Insufficient funds on your card/account</li>
                  <li>Card limit exceeded</li>
                  <li>Network/connectivity issues during payment</li>
                  <li>Payment cancelled by you</li>
                  <li>Bank declined the transaction</li>
                </ul>
              </div>

              <!-- Booking Details -->
              <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 16px; font-weight: bold;">📋 Your Booking Details</h3>
                <table style="width: 100%; color: #374151; font-size: 14px;">
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px 0; font-weight: bold;">Booking Reference</td>
                    <td style="padding: 12px 0; text-align: right; color: #ef4444; font-weight: bold;">${details.bookingRef}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px 0; font-weight: bold;">Destination</td>
                    <td style="padding: 12px 0; text-align: right;">${details.destination}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px 0; font-weight: bold;">Travel Date</td>
                    <td style="padding: 12px 0; text-align: right;">${details.travelDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; font-weight: bold;">Amount to Pay</td>
                    <td style="padding: 12px 0; text-align: right; color: #ef4444; font-weight: bold;">₹${Number(details.amount).toLocaleString('en-IN')}</td>
                  </tr>
                </table>
              </div>

              <!-- Call to Action -->
              <div style="background: linear-gradient(135deg, #f59e42 0%, #ff8c42 100%); padding: 24px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
                <p style="margin: 0 0 16px 0; color: white; font-size: 14px;">
                  <strong>Your booking is still reserved for you!</strong><br/>
                  Please complete your payment as soon as possible.
                </p>
                <a href="${process.env.FRONTEND_URL || 'https://bharat-yaatra.netlify.app'}/BookHist.html" style="display: inline-block; background: white; color: #f59e42; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">
                  Retry Payment Now
                </a>
              </div>

              <!-- Help Section -->
              <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 14px; font-weight: bold;">💡 Troubleshooting Tips</h3>
                <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px; line-height: 1.8;">
                  <li>Check if you have sufficient balance</li>
                  <li>Try a different payment method</li>
                  <li>Clear your browser cache and try again</li>
                  <li>Check your internet connection</li>
                  <li>Contact your bank to verify transaction limits</li>
                </ul>
              </div>

              <!-- Support -->
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center; margin-bottom: 16px;">
                Still having issues?<br/>
                Contact our support team: <a href="mailto:bharatyatra001@gmail.com" style="color: #f59e42; text-decoration: none; font-weight: bold;">bharatyatra001@gmail.com</a><br/>
                Phone: <strong>+91 98765 43210</strong>
              </p>

              <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; text-align: center;">
                <strong>Note:</strong> Your booking will be held for 24 hours. After that, we may release the slot. Please complete payment soon.
              </p>
            </div>

            <!-- Footer -->
            <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0 0 12px 0;">© 2024 Bharat Yaatra. All rights reserved.</p>
              <p style="margin: 0;">We're here to help you explore incredible India! 🇮🇳✈️</p>
            </div>
          </div>
        </div>
      `
    });

    console.log('✅ Payment failed notification email sent to:', userEmail);
  } catch (error) {
    console.error('❌ Failed to send payment failed email:', error.message);
  }
};

const sendBookingConfirmationEmail = async (userEmail, booking, paymentMethod) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ Resend API key not configured - cannot send booking confirmation email');
    return;
  }

  try {
    const destinationName = booking.destination?.title || 'Your Destination';
    const travelDate = new Date(booking.travelDate).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const travelersInfo = booking.travelers?.map((t, i) => 
      `${i + 1}. ${t.name} (Age: ${t.age}, ${t.gender})`
    ).join('<br/>') || 'Information not available';

    const paymentMethodDisplay = {
      'card': '💳 Credit/Debit Card',
      'upi': '📱 UPI',
      'netbanking': '🏦 Net Banking',
      'wallet': '👛 Digital Wallet',
      'card_international': '💳 International Card'
    }[paymentMethod] || '💳 ' + (paymentMethod || 'Payment');

    await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: userEmail,
      subject: `Booking Confirmed! 🎉 - ${booking.bookingRef}`,
      html: `
        <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #f59e42 0%, #ff8c42 100%); padding: 20px; min-height: 100vh;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.15);">
            <!-- Header with gradient -->
            <div style="background: linear-gradient(135deg, #f59e42 0%, #ff8c42 100%); color: white; padding: 32px 24px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
              <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Your Booking is Confirmed!</h1>
              <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Get ready for an unforgettable journey</p>
            </div>

            <!-- Main Content -->
            <div style="padding: 32px 24px;">
              <!-- Greeting -->
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Dear ${booking.personalInfo?.name || userEmail.split('@')[0]},<br/>
                Thank you for booking with Bharat Yaatra! Your payment has been processed successfully and your trip is confirmed.
              </p>

              <!-- Booking Reference -->
              <div style="background: #fef3c7; border-left: 4px solid #f59e42; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; color: #92400e; font-size: 12px; font-weight: bold; text-transform: uppercase;">Booking Reference</p>
                <p style="margin: 8px 0 0 0; color: #1f2937; font-size: 20px; font-weight: bold;">${booking.bookingRef}</p>
              </div>

              <!-- Trip Details -->
              <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 16px; font-weight: bold;">📋 Trip Details</h3>
                <table style="width: 100%; color: #374151; font-size: 14px;">
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px 0; font-weight: bold;">Destination</td>
                    <td style="padding: 12px 0; text-align: right; color: #f59e42; font-weight: bold;">${destinationName}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px 0; font-weight: bold;">Package Type</td>
                    <td style="padding: 12px 0; text-align: right;">${booking.packageType || 'Standard'}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px 0; font-weight: bold;">Travel Date</td>
                    <td style="padding: 12px 0; text-align: right;">${travelDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; font-weight: bold;">Number of Travelers</td>
                    <td style="padding: 12px 0; text-align: right;">${booking.travelers?.length || 1} ${booking.travelers?.length > 1 ? 'Persons' : 'Person'}</td>
                  </tr>
                </table>
              </div>

              <!-- Travelers Information -->
              <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 16px; font-weight: bold;">👥 Travelers</h3>
                <div style="color: #374151; font-size: 14px; line-height: 1.8;">
                  ${travelersInfo}
                </div>
              </div>

              <!-- Payment Information -->
              <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 16px; font-weight: bold;">💳 Payment Information</h3>
                <table style="width: 100%; color: #374151; font-size: 14px;">
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px 0; font-weight: bold;">Payment Method</td>
                    <td style="padding: 12px 0; text-align: right;">${paymentMethodDisplay}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px 0; font-weight: bold;">Payment Status</td>
                    <td style="padding: 12px 0; text-align: right;"><span style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;">✓ COMPLETED</span></td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; font-weight: bold; font-size: 16px;">Total Amount Paid</td>
                    <td style="padding: 12px 0; text-align: right; color: #f59e42; font-weight: bold; font-size: 16px;">₹${Number(booking.totalPrice || 0).toLocaleString('en-IN')}</td>
                  </tr>
                </table>
              </div>

              <!-- What's Next -->
              <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 14px; font-weight: bold;">📝 What's Next?</h3>
                <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px; line-height: 1.8;">
                  <li>Check your email for additional trip details and itinerary</li>
                  <li>Download the Bharat Yaatra app for real-time updates</li>
                  <li>Our team will contact you 48 hours before your trip starts</li>
                  <li>Pack and get ready for an amazing adventure!</li>
                </ul>
              </div>

              <!-- Important Info -->
              <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                <h3 style="margin: 0 0 12px 0; color: #7f1d1d; font-size: 14px; font-weight: bold;">⚠️ Cancellation Policy</h3>
                <p style="margin: 0; color: #7f1d1d; font-size: 13px; line-height: 1.6;">
                  <strong>More than 14 days:</strong> 100% refund | <strong>7-14 days:</strong> 50% refund | <strong>Less than 7 days:</strong> Non-refundable. <a href="#" style="color: #ef4444; text-decoration: none; font-weight: bold;">View full policy</a>
                </p>
              </div>

              <!-- Contact Support -->
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center; margin-bottom: 0;">
                Questions? Contact our support team at <a href="mailto:bharatyatra001@gmail.com" style="color: #f59e42; text-decoration: none; font-weight: bold;">bharatyatra001@gmail.com</a> or call <strong>+91 98765 43210</strong>
              </p>
            </div>

            <!-- Footer -->
            <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0 0 12px 0;">© 2024 Bharat Yaatra. All rights reserved.</p>
              <p style="margin: 0;">Happy Travels! 🌍✈️</p>
            </div>
          </div>
        </div>
      `
    });

    console.log('✅ Booking confirmation email sent to:', userEmail);
  } catch (error) {
    console.error('❌ Failed to send booking confirmation email:', error.message);
  }
};

const sendCancellationPendingNotificationEmail = async (userEmail, details) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ Resend API key not configured - cannot send cancellation email');
    return;
  }

  try {
    await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: userEmail,
      subject: `Cancellation Request Received - ${details.bookingRef}`,
      html: `
        <div style="font-family: Arial, sans-serif; background: #f9fafb; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #1f2937; margin-bottom: 16px;">Cancellation Request Received</h2>
            
            <p style="color: #374151; line-height: 1.6;">Dear ${details.name || userEmail.split('@')[0]},</p>
            
            <p style="color: #374151; line-height: 1.6;">We have received your cancellation request for your booking with us. Here are the details:</p>
            
            <div style="background: #f3f4f6; border-left: 4px solid #f59e42; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <table style="width: 100%; color: #374151; font-size: 14px;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Booking Reference</td>
                  <td style="padding: 8px 0; text-align: right;"><strong>${details.bookingRef}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">Destination</td>
                  <td style="padding: 8px 0; text-align: right;">${details.destination}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">Refund Amount (${details.refundPercentage}%)</td>
                  <td style="padding: 8px 0; text-align: right;">₹${Number(details.refundAmount).toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">Status</td>
                  <td style="padding: 8px 0; text-align: right;"><span style="color: #ea580c; font-weight: bold;">Pending Admin Approval</span></td>
                </tr>
              </table>
            </div>
            
            <p style="color: #6b7280; line-height: 1.6; font-size: 14px;">Your refund will be processed within <strong>1-2 business days</strong> after our admin team reviews and approves your cancellation request.</p>
            
            <p style="color: #374151; line-height: 1.6;">If you have any questions, please don't hesitate to contact our support team at <a href="mailto:bharatyatra001@gmail.com" style="color: #f59e42; text-decoration: none;">bharatyatra001@gmail.com</a></p>
            
            <div style="border-top: 1px solid #e5e7eb; margin-top: 24px; padding-top: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p>© 2024 Bharat Yaatra. All rights reserved.</p>
            </div>
          </div>
        </div>
      `
    });

    console.log('✅ Cancellation pending notification email sent to:', userEmail);
  } catch (error) {
    console.error('❌ Failed to send cancellation email:', error.message);
  }
};

const sendRefundApprovedEmail = async (booking) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ Resend API key not configured - cannot send refund approval email');
    return;
  }

  try {
    const userEmail = booking.personalInfo?.email || booking.userId?.email;
    if (!userEmail) {
      console.warn('⚠️ No user email found for booking:', booking.bookingRef);
      return;
    }

    const refundDate = new Date(booking.refundCompletedAt).toLocaleDateString('en-IN');
    
    await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: userEmail,
      subject: `✅ Your Refund Has Been Approved - ₹${booking.refundAmount.toLocaleString('en-IN')}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">✅ Refund Approved</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 16px;">Dear <strong>${booking.personalInfo?.name || userEmail.split('@')[0]}</strong>,</p>
            
            <p style="color: #374151; line-height: 1.6;">
              Your refund request for booking <strong>${booking.bookingRef}</strong> has been approved by our team.
            </p>
            
            <div style="background: white; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Refund Details</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #374151;">Booking Reference</td>
                  <td style="padding: 8px 0; color: #374151; text-align: right;"><strong>${booking.bookingRef}</strong></td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; color: #374151;">Refund Amount</td>
                  <td style="padding: 8px 0; color: #10b981; text-align: right;"><strong>₹${booking.refundAmount.toLocaleString('en-IN')}</strong></td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; color: #374151;">Refund Percentage</td>
                  <td style="padding: 8px 0; color: #374151; text-align: right;"><strong>${booking.refundPercentage}%</strong></td>
                </tr>
                ${booking.razorpayRefundId ? `
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; color: #374151;">Refund ID</td>
                  <td style="padding: 8px 0; color: #6b7280; text-align: right; font-size: 12px;"><code>${booking.razorpayRefundId}</code></td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; color: #15803d; font-size: 14px;">
                <strong>💡 Timeline:</strong> The refund will be credited to your original payment method within <strong>3-5 business days</strong>. If you don't see it after 5 days, please contact our support team.
              </p>
            </div>
            
            <p style="color: #374151; line-height: 1.6; margin: 20px 0 0 0;">
              If you have any questions about your refund, please don't hesitate to contact us:
            </p>
            <p style="color: #6b7280; font-size: 14px; margin: 5px 0;">
              📧 Email: bharatyatra001@gmail.com<br/>
              🌐 Website: https://bharat-yatra.onrender.com
            </p>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Best regards,<br/>
              <strong>Bharat Yaatra Team</strong>
            </p>
          </div>
        </div>
      `,
    });

    console.log('✅ Refund approval email sent to:', userEmail);
  } catch (error) {
    console.error('❌ Failed to send refund approval email:', error.message);
    // Don't throw - email failure shouldn't block refund processing
  }
};

// ✅ EMAIL HELPER: Send refund rejected notification
const sendRefundRejectedEmail = async (booking, rejectionReason) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ Resend API key not configured - cannot send refund rejection email');
    return;
  }

  try {
    const userEmail = booking.personalInfo?.email || booking.userId?.email;
    if (!userEmail) {
      console.warn('⚠️ No user email found for booking:', booking.bookingRef);
      return;
    }

    await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: userEmail,
      subject: `Update on Your Refund Request - ${booking.bookingRef}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">⚠️ Refund Request Update</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 16px;">Dear <strong>${booking.personalInfo?.name || userEmail.split('@')[0]}</strong>,</p>
            
            <p style="color: #374151; line-height: 1.6;">
              Thank you for your refund request for booking <strong>${booking.bookingRef}</strong>. After careful review by our team, we regret to inform you that your refund request could not be approved.
            </p>
            
            <div style="background: white; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Booking Details</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #374151;">Booking Reference</td>
                  <td style="padding: 8px 0; color: #374151; text-align: right;"><strong>${booking.bookingRef}</strong></td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; color: #374151;">Cancellation Date</td>
                  <td style="padding: 8px 0; color: #374151; text-align: right;"><strong>${new Date(booking.cancellationRequestedAt).toLocaleDateString('en-IN')}</strong></td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Reason:</strong> ${rejectionReason || 'Please refer to our refund policy for more details.'}
              </p>
            </div>
            
            <p style="color: #374151; line-height: 1.6; margin: 20px 0;">
              We understand this may be disappointing. If you believe this decision was made in error or have any questions, please contact our support team - we're here to help!
            </p>
            
            <p style="color: #6b7280; font-size: 14px;">
              📧 Email: bharatyatra001@gmail.com<br/>
              🌐 Website: https://bharat-yatra.onrender.com
            </p>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Best regards,<br/>
              <strong>Bharat Yaatra Team</strong>
            </p>
          </div>
        </div>
      `,
    });

    console.log('✅ Refund rejection email sent to:', userEmail);
  } catch (error) {
    console.error('❌ Failed to send refund rejection email:', error.message);
    // Don't throw - email failure shouldn't block refund processing
  }
};

// ✅ ADMIN: APPROVE/REJECT REFUND REQUEST
router.post('/admin/refund-approval', auth, isAdmin, async (req, res) => {
  try {
    const { bookingId, action, approvalReason } = req.body; // action: 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "approve" or "reject"'
      });
    }

    // Find booking with user details for email
    const booking = await Booking.findById(bookingId).populate('user', 'email');
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // ❌ PREVENT DOUBLE REFUND ATTEMPT
    if (booking.refundStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: `⚠️ This refund has already been processed (completed).`,
        data: {
          bookingRef: booking.bookingRef,
          refundStatus: 'completed',
          razorpayRefundId: booking.razorpayRefundId,
          completedAt: booking.refundCompletedAt
        }
      });
    }

    if (booking.refundStatus === 'rejected') {
      return res.status(400).json({
        success: false,
        message: `⚠️ This refund request has already been rejected.`,
        data: {
          bookingRef: booking.bookingRef,
          refundStatus: 'rejected',
          reason: booking.adminApprovalReason
        }
      });
    }

    if (booking.refundStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot process. Refund status is: ${booking.refundStatus}`
      });
    }

    if (action === 'reject') {
      // Reject refund with audit tracking
      const rejectedBooking = await Booking.findByIdAndUpdate(bookingId, {
        refundStatus: 'rejected',
        adminApprovedBy: req.user.userId, // Track which admin rejected
        adminApprovalReason: approvalReason || 'Admin rejected refund request'
      }, { new: true }).populate('adminApprovedBy', 'email');

      // 🔕 Refund rejection notification disabled by request

      console.log('❌ Refund Rejected:', {
        bookingRef: rejectedBooking.bookingRef,
        rejectedBy: req.user.userId,
        reason: approvalReason
      });

      return res.status(200).json({
        success: true,
        message: 'Refund request rejected',
        data: {
          bookingRef: rejectedBooking.bookingRef,
          refundStatus: 'rejected',
          rejectedBy: rejectedBooking.adminApprovedBy?.email,
          reason: rejectedBooking.adminApprovalReason
        }
      });
    }

    // Process APPROVAL
    if (action === 'approve') {
      // Check if Razorpay is configured
      if (!process.env.RAZORPAY_KEY_SECRET || !process.env.RAZORPAY_KEY_ID) {
        return res.status(503).json({
          success: false,
          message: 'Payment service not configured. Razorpay credentials missing.'
        });
      }

      let razorpayRefundId = null;

      // ✅ SAFETY CHECK: Verify refund amount and Razorpay payment ID
      if (!booking.razorpayPaymentId) {
        return res.status(400).json({
          success: false,
          message: '⚠️ Cannot process refund: Razorpay Payment ID not found in booking',
          data: {
            bookingRef: booking.bookingRef,
            reason: 'Missing payment transaction data'
          }
        });
      }

      // Process Razorpay refund only if amount > 0
      if (booking.refundAmount > 0) {
        try {
          const razorpayAuthHeader = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
          const refundRes = await fetch(`https://api.razorpay.com/v1/payments/${booking.razorpayPaymentId}/refund`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${razorpayAuthHeader}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              amount: Math.round(booking.refundAmount * 100) // Convert to paise
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
            message: 'Failed to process Razorpay refund',
            error: err.message
          });
        }
      }

      // Mark as COMPLETED with audit tracking
      const approvedBooking = await Booking.findByIdAndUpdate(
        bookingId,
        {
          refundStatus: 'completed',
          razorpayRefundId: razorpayRefundId,
          refundCompletedAt: new Date(),
          adminApprovedBy: req.user.userId, // Track which admin approved
          adminApprovalReason: approvalReason || 'Refund approved by admin' // Admin's notes
        },
        { new: true }
      ).populate('adminApprovedBy', 'email');

      // 🔕 Refund approval notification disabled by request

      console.log('✅ Refund Approved and Processed:', {
        bookingRef: approvedBooking.bookingRef,
        approvedBy: req.user.userId,
        razorpayRefundId,
        amount: approvedBooking.refundAmount
      });

      return res.status(200).json({
        success: true,
        message: 'Refund approved and processed successfully',
        data: {
          bookingRef: approvedBooking.bookingRef,
          refundAmount: approvedBooking.refundAmount,
          refundStatus: 'completed',
          razorpayRefundId,
          approvedBy: approvedBooking.adminApprovedBy?.email,
          approvalReason: approvedBooking.adminApprovalReason
        }
      });
    }
  } catch (error) {
    console.error('❌ Refund approval error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Refund approval processing failed',
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
