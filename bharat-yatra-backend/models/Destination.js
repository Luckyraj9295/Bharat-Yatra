const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Destination title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price per person is required'],
    min: [0, 'Price must be a positive number']
  },
  imagePath: {
    type: String,
    default: ''
  },
  brochurePath: {
    type: String,
    default: ''
  },
  duration: {
  type: String,
  required: true
},
  moreDestination: {
  type: Boolean,
  default: false
}
}, {
  timestamps: true
});

module.exports = mongoose.model('Destination', destinationSchema);
