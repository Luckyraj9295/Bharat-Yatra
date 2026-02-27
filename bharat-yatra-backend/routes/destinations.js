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

module.exports = router;
