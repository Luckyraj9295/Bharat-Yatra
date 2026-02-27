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

// 📥 Public - Generate signed URL for brochure download
router.get('/download-brochure', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ message: 'URL parameter required' });
    }

    console.log('📥 Generating signed URL for:', url);

    const cloudinary = require('../config/cloudinary');
    
    // Extract public_id from URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const uploadIndex = pathParts.findIndex(part => part === 'upload');
    
    if (uploadIndex === -1) {
      console.error('❌ Invalid Cloudinary URL format');
      return res.status(400).json({ message: 'Invalid Cloudinary URL' });
    }
    
    // Get everything after 'upload' (skip version if present)
    let publicIdParts = pathParts.slice(uploadIndex + 1);
    if (publicIdParts[0] && /^v\d+$/.test(publicIdParts[0])) {
      publicIdParts.shift(); // Remove version
    }
    const publicId = publicIdParts.join('/');
    
    console.log('📎 Extracted public_id:', publicId);
    
    // Determine resource type (raw for PDFs, image for images)
    const resourceType = publicId.includes('.pdf') ? 'raw' : 'image';
    
    // Generate signed URL with 1 hour expiry
    const signedUrl = cloudinary.url(publicId, {
      resource_type: resourceType,
      type: 'upload',
      sign_url: true,
      secure: true,
      flags: 'attachment', // Force download
      expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    });
    
    console.log('✅ Generated signed URL');
    res.json({ signedUrl });
    
  } catch (err) {
    console.error('❌ Error generating signed URL:', err);
    res.status(500).json({ message: 'Failed to generate download URL', error: err.message });
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
