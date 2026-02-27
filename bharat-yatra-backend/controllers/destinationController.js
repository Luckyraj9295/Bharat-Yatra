const fs = require('fs');
const path = require('path');
const Destination = require('../models/Destination');

// ➕ Create a new destination
exports.createDestination = async (req, res) => {
  try {
    const { title, description, price, duration, moreDestination } = req.body;

    const imagePath = req.files?.image?.[0]?.path || '';
    const brochurePath = req.files?.brochure?.[0]?.path || '';

    const newDestination = new Destination({
      title,
      description,
      price: parseFloat(price),
      duration: duration || '',
      imagePath,
      brochurePath,
      moreDestination: moreDestination === 'true' || moreDestination === true
    });

    const saved = await newDestination.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('❌ Error creating destination:', err);
    res.status(500).json({ message: 'Failed to create destination', error: err.message });
  }
};

// 🌐 Public - Get all visible destinations (not hidden)
exports.getDestinations = async (_, res) => {
  try {
    const all = await Destination.find();
    const visible = all.filter(d => !d.isHidden); // assumes isHidden field may exist
    res.json(visible);
  } catch (err) {
    console.error('❌ Error fetching destinations:', err);
    res.status(500).json({ message: 'Failed to fetch destinations', error: err.message });
  }
};

// 🔒 Admin - Get all destinations (including hidden)
exports.getAllDestinations = async (_, res) => {
  try {
    const all = await Destination.find();
    res.json(all);
  } catch (err) {
    console.error('❌ Error fetching all destinations:', err);
    res.status(500).json({ message: 'Failed to fetch all destinations', error: err.message });
  }
};

// 🔍 Public - Get a single destination by ID
exports.getDestinationById = async (req, res) => {
  try {
    const { id } = req.params;
    const destination = await Destination.findById(id);
    if (!destination) {
      return res.status(404).json({ message: 'Destination not found' });
    }
    res.json(destination);
  } catch (err) {
    console.error('❌ Error fetching destination by ID:', err);
    res.status(500).json({ message: 'Failed to fetch destination', error: err.message });
  }
};

// ✏️ Admin - Update a destination by ID (only keep this one)
exports.updateDestination = async (req, res) => {
  try {
    const { id } = req.params;
    const destination = await Destination.findById(id);
    if (!destination) return res.status(404).json({ message: 'Destination not found' });

    const updates = { ...req.body };

    // 🧹 Replace image if a new one is uploaded
    if (req.files?.image?.[0]) {
      const oldImagePath = destination.imagePath;
      const newImagePath = req.files.image[0].path;
      updates.imagePath = newImagePath;

      if (oldImagePath && fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
        console.log('🗑️ Replaced image:', oldImagePath);
      }
    }

    // 🧹 Replace brochure if a new one is uploaded
    if (req.files?.brochure?.[0]) {
      const oldBrochurePath = destination.brochurePath;
      const newBrochurePath = req.files.brochure[0].path;
      updates.brochurePath = newBrochurePath;

      if (oldBrochurePath && fs.existsSync(oldBrochurePath)) {
        fs.unlinkSync(oldBrochurePath);
        console.log('🗑️ Replaced brochure:', oldBrochurePath);
      }
    }

    if (updates.price) updates.price = parseFloat(updates.price);
    if (updates.moreDestination !== undefined) {
      updates.moreDestination = updates.moreDestination === 'true' || updates.moreDestination === true;
    }
    if (updates.duration === undefined) updates.duration = '';

    const updated = await Destination.findByIdAndUpdate(id, updates, { new: true });
    res.json(updated);
  } catch (err) {
    console.error('❌ Error updating destination:', err);
    res.status(500).json({ message: 'Failed to update destination', error: err.message });
  }
};

// ❌ Admin - Delete a destination by ID
exports.deleteDestination = async (req, res) => {
  try {
    const { id } = req.params;
    const destination = await Destination.findById(id);
    if (!destination) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    // 🧹 Delete image file if exists
    if (destination.imagePath) {
      const imageFullPath = path.join(__dirname, '..', destination.imagePath.startsWith('/') ? destination.imagePath.slice(1) : destination.imagePath);
      if (fs.existsSync(imageFullPath)) {
        fs.unlinkSync(imageFullPath);
        console.log('🗑️ Deleted image:', imageFullPath);
      }
    }

    // 🧹 Delete brochure file if exists
    if (destination.brochurePath) {
      const brochureFullPath = path.join(__dirname, '..', destination.brochurePath.startsWith('/') ? destination.brochurePath.slice(1) : destination.brochurePath);
      if (fs.existsSync(brochureFullPath)) {
        fs.unlinkSync(brochureFullPath);
        console.log('🗑️ Deleted brochure:', brochureFullPath);
      }
    }

    await Destination.findByIdAndDelete(id);
    res.json({ message: 'Destination deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting destination:', err);
    res.status(500).json({ message: 'Failed to delete destination', error: err.message });
  }
};
