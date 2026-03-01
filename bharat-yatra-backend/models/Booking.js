const mongoose = require('mongoose');

// Sub-schema for each traveler
const travelerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true }
}, { _id: false });

// Main booking schema
const bookingSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  destination: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Destination', 
    required: true 
  },
  packageType: { 
    type: String, 
    enum: ['Standard', 'Deluxe', 'Premium'], 
    default: 'Standard' 
  },
  travelers: {
    type: [travelerSchema],
    validate: [arr => arr.length > 0, 'At least one traveler is required.']
  },
  travelDate: {  // ✅ NEW FIELD
    type: String,
    required: true
  },
  
  personalInfo: {
    phone: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    email: { type: String, required: true },
    pin: { type: String, required: true }
  },
  upiId: { type: String, default: null },

  specialRequests: {  // ✅ New field
    type: String,
    default: ''
  },

  bookingRef: { type: String, unique: true, required: true },
  totalPrice: { type: Number, required: true },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  razorpayPaymentId: {
    type: String,
    default: null
  },
  razorpayOrderId: {
    type: String,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'netbanking', 'wallet', 'upi', 'unknown'],
    default: 'unknown'
  },
  paymentCompletedAt: {
    type: Date,
    default: null
  },
  bookingStatus: {
    type: String,
    enum: ['active', 'cancelled'],
    default: 'active'
  },
  cancellationReason: {
    type: String,
    default: null
  },
  cancellationRequestedAt: {
    type: Date,
    default: null
  },
  refundStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected', 'completed'],
    default: 'none'
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  refundPercentage: {
    type: Number,
    default: 0
  },
  refundReason: {
    type: String,
    default: null
  },
  razorpayRefundId: {
    type: String,
    default: null
  },
  refundCompletedAt: {
    type: Date,
    default: null
  },
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('Booking', bookingSchema);
