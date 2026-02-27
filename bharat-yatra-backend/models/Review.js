const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  destination: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Destination',
    required: [true, 'Destination reference is required']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  name: {
    type: String,
    default: 'Anonymous',
    trim: true
  },
  rating: {
    type: Number,
    min: [1, 'Minimum rating is 1'],
    max: [5, 'Maximum rating is 5'],
    required: [true, 'Overall rating is required']
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [500, 'Comment should not exceed 500 characters']
  },
  food: {
    type: Number,
    min: [1, 'Minimum is 1'],
    max: [5, 'Maximum is 5'],
    default: undefined
  },
  lodging: {
    type: Number,
    min: [1, 'Minimum is 1'],
    max: [5, 'Maximum is 5'],
    default: undefined
  },
  transportation: {
    type: Number,
    min: [1, 'Minimum is 1'],
    max: [5, 'Maximum is 5'],
    default: undefined
  },
  hotels: {
    type: Number,
    min: [1, 'Minimum is 1'],
    max: [5, 'Maximum is 5'],
    default: undefined
  }
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
