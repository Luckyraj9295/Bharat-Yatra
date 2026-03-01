const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { Resend } = require('resend');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

const router = express.Router();

// Initialize Resend for email notifications
const resend = new Resend(process.env.RESEND_API_KEY);

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

    // ⚠️ Check payment status - must be completed to cancel
    if (booking.paymentStatus !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking. Payment status: ${booking.paymentStatus}. Only paid bookings can be cancelled.`
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

    // 📧 TODO: Send cancellation confirmation email to user (refund pending approval)
    // const User = require('../models/User');
    // const user = await User.findById(booking.user);
    // if (user && user.email) {
    //   await sendCancellationPendingNotificationEmail(user.email, {
    //     bookingRef: updatedBooking.bookingRef,
    //     refundAmount,
    //     refundReason
    //   });
    // }

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
      from: "Bharat Yatra <onboarding@resend.dev>",
      to: userEmail,
      subject: `✅ Your Refund Has Been Approved - ₹${booking.refundAmount.toLocaleString('en-IN')}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">✅ Refund Approved</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 16px;">Dear <strong>${booking.personalInfo?.name || 'Traveler'}</strong>,</p>
            
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
              <strong>Bharat Yatra Team</strong>
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
      from: "Bharat Yatra <onboarding@resend.dev>",
      to: userEmail,
      subject: `Update on Your Refund Request - ${booking.bookingRef}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">⚠️ Refund Request Update</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 16px;">Dear <strong>${booking.personalInfo?.name || 'Traveler'}</strong>,</p>
            
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
              <strong>Bharat Yatra Team</strong>
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

    // Find booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.refundStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot process. Refund status is: ${booking.refundStatus}`
      });
    }

    if (action === 'reject') {
      // Reject refund
      const rejectedBooking = await Booking.findByIdAndUpdate(bookingId, {
        refundStatus: 'rejected',
        refundReason: approvalReason || 'Admin rejected refund request'
      }, { new: true });

      // 📧 Send rejection email to user
      await sendRefundRejectedEmail(rejectedBooking, approvalReason || 'Your refund request could not be approved at this time.');

      return res.status(200).json({
        success: true,
        message: 'Refund request rejected',
        data: {
          bookingRef: rejectedBooking.bookingRef,
          refundStatus: 'rejected'
        }
      });
    }

    // Process APPROVAL
    if (action === 'approve') {
      let razorpayRefundId = null;

      // Process Razorpay refund only if amount > 0
      if (booking.refundAmount > 0) {
        try {
          const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
          const refundRes = await fetch(`https://api.razorpay.com/v1/payments/${booking.razorpayPaymentId}/refund`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
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

      // Mark as COMPLETED
      const approvedBooking = await Booking.findByIdAndUpdate(
        bookingId,
        {
          refundStatus: 'completed',
          razorpayRefundId: razorpayRefundId,
          refundCompletedAt: new Date()
        },
        { new: true }
      );

      // 📧 Send refund approval email to user with refund details
      await sendRefundApprovedEmail(approvedBooking);

      console.log('✅ Refund Approved and Processed:', {
        bookingRef: approvedBooking.bookingRef,
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
          razorpayRefundId
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
