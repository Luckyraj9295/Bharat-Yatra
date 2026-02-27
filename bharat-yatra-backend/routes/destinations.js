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

// 📥 Public - Proxy brochure download to avoid CORS/auth issues
router.get('/download-brochure', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ message: 'URL parameter required' });
    }

    console.log('📥 Proxy download request for:', url);

    const https = require('https');
    const http = require('http');
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (cloudinaryRes) => {
      console.log('📡 Cloudinary response status:', cloudinaryRes.statusCode);
      console.log('📡 Cloudinary response headers:', cloudinaryRes.headers);
      
      if (cloudinaryRes.statusCode === 404) {
        console.error('❌ File not found at Cloudinary URL');
        return res.status(404).json({ message: 'File not found' });
      }
      
      if (cloudinaryRes.statusCode !== 200) {
        console.error('❌ Unexpected status from Cloudinary:', cloudinaryRes.statusCode);
        return res.status(cloudinaryRes.statusCode).json({ message: 'Failed to fetch file' });
      }

      // Set headers to force download
      res.setHeader('Content-Type', cloudinaryRes.headers['content-type'] || 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment');
      
      // Pipe the Cloudinary response to client
      cloudinaryRes.pipe(res);
    }).on('error', (err) => {
      console.error('❌ Error fetching from Cloudinary:', err);
      res.status(500).json({ message: 'Failed to download file' });
    });
  } catch (err) {
    console.error('❌ Download proxy error:', err);
    res.status(500).json({ message: 'Failed to download file' });
  }
});

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
