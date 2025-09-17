const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const auth = require('../middleware/auth');

// ✅ POST a new review (requires login)
router.post('/', auth, reviewController.createReview);

// ✅ GET all reviews for a specific destination (public route)
router.get('/:destinationId', reviewController.getReviews);

module.exports = router;
