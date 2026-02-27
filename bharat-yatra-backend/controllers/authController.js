const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('../config/cloudinary');

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

const deleteCloudinaryAsset = async (url) => {
  const publicId = extractCloudinaryPublicId(url);
  if (!publicId) return;
  try {
    // Profile images are always 'image' type
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.error('Error deleting Cloudinary asset:', err.message);
  }
};


// ✅ REGISTER
exports.register = async (req, res) => {
  try {
    const name = req.body.name.trim();
    const email = req.body.email.trim();
    const password = req.body.password;
    const profileImage = req.body.profileImage || ''; // fixed key name

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({
      name,
      email,
      password,
      profileImage
    });

    const token = jwt.sign(
      { userId: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: user.toJSON() });

  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ LOGIN
exports.login = async (req, res) => {
  try {
    const email = req.body.email?.trim();
    const password = req.body.password;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: user.toJSON() });

  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ GET USERS (admin only)
exports.getUsers = async (_, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Old password is incorrect' });

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    let { name, email, phone, state, city, pin, profileImage } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 💡 If email is being changed, check if already used
    if (email && email.trim() !== user.email) {
      const existing = await User.findOne({ email: email.trim() });
      if (existing) return res.status(400).json({ message: 'Email already in use' });
      user.email = email.trim();
    }

    if (name) user.name = name.trim();
    if (phone) user.phone = phone.trim();
    if (state) user.state = state.trim();
    if (city) user.city = city.trim();
    if (pin) user.pin = pin.trim();

    // ✅ Support clearing profileImage when it's an empty string
    if (profileImage !== undefined) {
      if (profileImage.trim() === '' && user.profileImage) {
        await deleteCloudinaryAsset(user.profileImage);
        user.profileImage = '';
      } else {
        user.profileImage = profileImage.trim();
      }
    }



    await user.save();
    res.json({ message: 'Profile updated successfully', user: user.toJSON() });

  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
