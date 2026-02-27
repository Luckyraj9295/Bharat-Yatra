const Booking = require('../models/Booking');
const Destination = require('../models/Destination');

// 🔐 Generate unique booking reference
const generateRef = () =>
  'BY' + Math.random().toString(36).substr(2, 5).toUpperCase() + Date.now().toString().slice(-4);

// ✅ Create a new booking
exports.createBooking = async (req, res) => {
  try {
    const {
      destinationId,
      packageType,
      travelers,
      personalInfo,
      travelDate,
      upiId,
      specialRequests
    } = req.body;

    const destination = await Destination.findById(destinationId);
    if (!destination) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    const priceMultiplier = { Standard: 1, Deluxe: 1.5, Premium: 2 }[packageType] || 1;
    const totalPrice = destination.price * travelers.length * priceMultiplier;

    const booking = await Booking.create({
      user: req.user.userId,
      destination: destinationId,
      packageType,
      travelers,
      personalInfo,
      travelDate,
      upiId,
      totalPrice,
      specialRequests,
      bookingRef: generateRef()
    });

    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 👤 Get bookings of the logged-in user
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.userId })
      .populate('destination');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🛡️ Admin: Get all bookings
exports.getAllBookings = async (_, res) => {
  try {
    const bookings = await Booking.find()
      .populate('destination')
      .populate('user', '-password');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ❌ Cancel a booking by its owner
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOneAndDelete({
      _id: req.params.id,
      user: req.user.userId
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found or unauthorized.' });
    }

    res.json({ message: 'Booking cancelled successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✏️ Update specialRequests of a booking (no travel date check here)
exports.updateSpecialRequest = async (req, res) => {
  try {
    const { specialRequests } = req.body;

    const booking = await Booking.findOne({
      _id: req.params.id,
      user: req.user.userId
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found or unauthorized.' });
    }

    booking.specialRequests = specialRequests;
    await booking.save();

    res.json({ message: 'Special request updated successfully.', booking });
  } catch (err) {
    console.error('Error updating special request:', err);
    res.status(500).json({ message: err.message });
  }
};
