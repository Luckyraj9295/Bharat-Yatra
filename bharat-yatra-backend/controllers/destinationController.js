const cloudinary = require('../config/cloudinary');
const Destination = require('../models/Destination');

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
  if (!publicId) {
    console.log('⚠️ Could not extract public ID from:', url);
    return;
  }
  
  try {
    // Detect resource type based on folder path or extension
    const resourceType = publicId.includes('brochures/') ? 'raw' : 'image';
    console.log(`🗑️ Deleting ${resourceType} from Cloudinary:`, publicId);
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    console.log('✅ Asset deleted successfully');
  } catch (err) {
    console.warn(`⚠️ First deletion attempt failed (${err.message}), trying fallback...`);
    // If detection fails, try both types
    try {
      console.log('   Trying as image type...');
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
      console.log('✅ Asset deleted as image type');
    } catch (err2) {
      try {
        console.log('   Trying as raw type...');
        await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
        console.log('✅ Asset deleted as raw type');
      } catch (err3) {
        console.error('❌ Failed to delete asset:', publicId, err3.message);
        // Don't throw - allow update to continue even if deletion fails
      }
    }
  }
};

// ➕ Create a new destination
exports.createDestination = async (req, res) => {
  try {
    console.log('➕ Create request received');
    console.log('   Title:', req.body.title);
    console.log('   Has image:', req.files?.image?.length > 0);
    console.log('   Has brochure:', req.files?.brochure?.length > 0);
    
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
    console.log('✅ Destination created:', saved._id);
    res.status(201).json(saved);
  } catch (err) {
    console.error('❌ Error creating destination:', err.message);
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
    console.log('🔍 Update request received for ID:', req.params.id);
    console.log('📋 Request body keys:', Object.keys(req.body));
    console.log('📁 Request files detected:', req.files ? Object.keys(req.files) : 'none');
    
    const { id } = req.params;
    const destination = await Destination.findById(id);
    if (!destination) return res.status(404).json({ message: 'Destination not found' });

    const updates = { ...req.body };
    
    // Remove file paths from body if they somehow get there
    delete updates.imagePath;
    delete updates.brochurePath;

    // 🧹 Replace image if a new one is uploaded
    if (req.files?.image?.length > 0) {
      console.log('🖼️ New image detected:', req.files.image[0].path);
      const oldImagePath = destination.imagePath;
      const newImagePath = req.files.image[0].path;
      updates.imagePath = newImagePath;

      if (oldImagePath && oldImagePath.trim()) {
        console.log('🗑️ Deleting old image:', oldImagePath);
        try {
          await deleteCloudinaryAsset(oldImagePath);
        } catch (delErr) {
          console.error('⚠️ Error deleting old image (continuing anyway):', delErr.message);
        }
      }
    }

    // 🧹 Replace brochure if a new one is uploaded
    if (req.files?.brochure?.length > 0) {
      console.log('📄 New brochure detected:', req.files.brochure[0].path);
      const oldBrochurePath = destination.brochurePath;
      const newBrochurePath = req.files.brochure[0].path;
      updates.brochurePath = newBrochurePath;

      if (oldBrochurePath && oldBrochurePath.trim()) {
        console.log('🗑️ Deleting old brochure:', oldBrochurePath);
        try {
          await deleteCloudinaryAsset(oldBrochurePath);
        } catch (delErr) {
          console.error('⚠️ Error deleting old brochure (continuing anyway):', delErr.message);
        }
      }
    }

    // Clean up numeric fields
    if (updates.price) updates.price = parseFloat(updates.price);
    if (updates.moreDestination !== undefined) {
      updates.moreDestination = updates.moreDestination === 'true' || updates.moreDestination === true;
    }
    if (updates.duration === undefined || updates.duration === '') {
      updates.duration = destination.duration || '';
    }

    console.log('💾 Updating database with:', { 
      title: updates.title, 
      hasImage: !!updates.imagePath,
      hasBrochure: !!updates.brochurePath
    });
    
    const updated = await Destination.findByIdAndUpdate(id, updates, { new: true });
    console.log('✅ Update successful');
    res.json(updated);
  } catch (err) {
    console.error('❌ Error updating destination:');
    console.error('   Message:', err.message);
    console.error('   Stack:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
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

    // 🧹 Delete image if exists
    if (destination.imagePath) {
      await deleteCloudinaryAsset(destination.imagePath);
    }

    // 🧹 Delete brochure if exists
    if (destination.brochurePath) {
      await deleteCloudinaryAsset(destination.brochurePath);
    }

    await Destination.findByIdAndDelete(id);
    res.json({ message: 'Destination deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting destination:', err);
    res.status(500).json({ message: 'Failed to delete destination', error: err.message });
  }
};
