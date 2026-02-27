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
  upiId: { type: String, required: true },

  specialRequests: {  // ✅ New field
    type: String,
    default: ''
  },

  bookingRef: { type: String, unique: true, required: true },
  totalPrice: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('Booking', bookingSchema);
