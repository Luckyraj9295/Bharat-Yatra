const multer = require("multer");
const path = require("path");

// 🔧 Set storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/profile"); // Save to uploads/profile/
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `user-${Date.now()}${ext}`;
    cb(null, uniqueName);
  },
});

// ✅ File filter to allow only image formats
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, and WEBP image files are allowed"), false);
  }
};

// 📦 Multer upload instance
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Max size: 2MB
  fileFilter,
});

module.exports = upload;
