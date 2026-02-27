const express = require('express');
const router = express.Router();

const bookingController = require('../controllers/bookingController');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// 🔐 Authenticated users can create bookings
router.post('/', auth, bookingController.createBooking);

// 👤 Authenticated users can view their own bookings
router.get('/me', auth, bookingController.getMyBookings);

// 🛡️ Admins can view all bookings
router.get('/', auth, isAdmin, bookingController.getAllBookings);

// ❌ Authenticated users can cancel (delete) their own booking
router.delete('/:id', auth, bookingController.cancelBooking);

// ✏️ Authenticated users can update specialRequests in their own booking
router.patch('/:id', auth, bookingController.updateSpecialRequest); // 🔥 new route

module.exports = router;
