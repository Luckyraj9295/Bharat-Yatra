const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const { uploadProfile } = require('../middleware/upload'); // ✅ Use centralized multer config
const cloudinary = require('../config/cloudinary');

// 🌐 Register
router.post('/register', authController.register);

// 🔐 Login
router.post('/login', authController.login);

// 🔁 Password Reset
router.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ message: 'Email and new password required' });
  }

  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    const user = await require('../models/User').findOneAndUpdate(
      { email },
      { password: hashed },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 🔐 Change Password (authenticated)
router.put('/change-password', auth, authController.changePassword);

const extractCloudinaryPublicId = (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/');
    const uploadIndex = parts.findIndex((part) => part === 'upload');
    if (uploadIndex === -1) return null;
    const publicIdParts = parts.slice(uploadIndex + 1);
    if (publicIdParts[0] && /^v\d+$/.test(publicIdParts[0])) {
      publicIdParts.shift();
    }
    const filename = publicIdParts.join('/');
    return filename.replace(/\.[^/.]+$/, '');
  } catch {
    return null;
  }
};

// 📸 Upload/Update Profile Image using upload.js
router.put('/profile-image', auth, uploadProfile.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

    const user = await require('../models/User').findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ❌ Delete old image if it exists and is not the default
    if (user.profileImage) {
      const publicId = extractCloudinaryPublicId(user.profileImage);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
      }
    }

    // ✅ Update to new image
    user.profileImage = req.file.path;
    await user.save();

    res.json({ message: 'Profile image updated', profileImage: user.profileImage });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// 📝 Update profile fields (name, email, phone, city, state, pin, profileImage)
router.put('/profile', auth, authController.updateProfile);
// 👤 Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await require('../models/User').findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 🛡️ Get All Users (admin only)
router.get('/users', auth, isAdmin, authController.getUsers);

module.exports = router;
