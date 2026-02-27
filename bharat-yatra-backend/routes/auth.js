const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const upload = require('../middleware/upload'); // ✅ Use centralized multer config

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

// 📸 Upload/Update Profile Image using upload.js
router.put('/profile-image', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

    const user = await require('../models/User').findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ❌ Delete old image if it exists and is not the default
    if (user.profileImage) {
      const oldPath = path.join(__dirname, '..', user.profileImage.startsWith('/') ? user.profileImage.slice(1) : user.profileImage);

      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // ✅ Update to new image
    user.profileImage = `/uploads/profile/${req.file.filename}`;
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
