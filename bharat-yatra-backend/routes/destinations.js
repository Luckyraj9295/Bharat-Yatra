const express = require('express');
const router = express.Router();
const destinationController = require('../controllers/destinationController');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const { uploadDestination } = require('../middleware/upload');

/* ======================== ROUTES ======================== */

// 🌐 Public - Get all visible destinations
router.get('/', destinationController.getDestinations);

// 🔐 Admin - Get all destinations (including hidden)
router.get('/all', auth, isAdmin, destinationController.getAllDestinations);

// ➕ Admin - Create destination
router.post(
  '/',
  auth,
  isAdmin,
  uploadDestination.fields([
    { name: 'image', maxCount: 1 },
    { name: 'brochure', maxCount: 1 }
  ]),
  destinationController.createDestination
);

// ✏️ Admin - Update destination by ID
router.put(
  '/:id',
  auth,
  isAdmin,
  uploadDestination.fields([
    { name: 'image', maxCount: 1 },
    { name: 'brochure', maxCount: 1 }
  ]),
  destinationController.updateDestination
);

// ❌ Admin - Delete destination by ID
router.delete(
  '/:id',
  auth,
  isAdmin,
  destinationController.deleteDestination
);

// 🔍 Public - Get destination by ID
router.get('/:id', destinationController.getDestinationById);

// ❌ Multer error handler
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File too large. Max 10MB allowed.' });
  }
  if (err.message && err.message.includes('Only JPEG, PNG, WEBP')) {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ message: 'Too many files.' });
  }
  next(err);
});

module.exports = router;
