const Review = require('../models/Review');
const User = require('../models/User');
const Destination = require('../models/Destination');

// ✅ POST: Create a new review
exports.createReview = async (req, res) => {
  try {
    const {
  destinationId,
  rating, // ✅ Add this
  comment,
  food,
  lodging,
  transportation,
  hotels
} = req.body;

    // 🚫 Ensure destination and comment provided
    if (!destinationId || !comment) {
      return res.status(400).json({ message: 'Destination and comment are required.' });
    }

    // ✅ Validate user and destination
    const destinationExists = await Destination.findById(destinationId);
    if (!destinationExists) {
      return res.status(404).json({ message: 'Destination not found.' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // 🚫 Prevent duplicate reviews
    const existingReview = await Review.findOne({
      destination: destinationId,
      user: req.user.userId
    });
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this destination.' });
    }

    // ✅ Calculate average from provided category ratings
  let averageRating;

const categoryRatings = [food, lodging, transportation, hotels]
  .map(r => Number(r))
  .filter(r => !isNaN(r) && r >= 1 && r <= 5);

if (categoryRatings.length > 0) {
  averageRating = Number(
    (categoryRatings.reduce((sum, r) => sum + r, 0) / categoryRatings.length).toFixed(1)
  );
} else if (rating && rating >= 1 && rating <= 5) {
  averageRating = Number(rating);
} else {
  return res.status(400).json({ message: 'At least one valid rating (1–5) is required.' });
}


    // ✅ Create review
    const newReview = await Review.create({
  destination: destinationId,
  user: user._id,
  name: user.name || 'Anonymous',
  rating: averageRating, // ✅ Use computed rating
  comment: comment.trim(),
  food: food ? Number(food) : undefined,
  lodging: lodging ? Number(lodging) : undefined,
  transportation: transportation ? Number(transportation) : undefined,
  hotels: hotels ? Number(hotels) : undefined
});


    res.status(201).json(newReview);
  } catch (err) {
    console.error('Review creation failed:', err);
    res.status(500).json({ message: 'Server error while creating review.', error: err.message });
  }
};

// ✅ GET: Get all reviews for a destination
exports.getReviews = async (req, res) => {
  try {
    const { destinationId } = req.params;

    const reviews = await Review.find({ destination: destinationId })
      .sort({ createdAt: -1 })
      .populate('user', 'name profileImage');

    res.json(reviews);
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ message: 'Failed to fetch reviews', error: err.message });
  }
};
