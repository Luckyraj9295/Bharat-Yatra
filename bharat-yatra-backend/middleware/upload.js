const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// ✅ File filter to allow images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WEBP images and PDF files are allowed"), false);
  }
};

const buildStorage = (folder) =>
  new CloudinaryStorage({
    cloudinary,
    params: {
      folder,
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
    },
  });

const buildDynamicStorage = () =>
  new CloudinaryStorage({
    cloudinary,
    params: (req, file) => ({
      folder:
        file.fieldname === "image"
          ? "bharat-yatra/destinations"
          : "bharat-yatra/brochures",
      resource_type: "auto", // Auto-detect type (image or raw for PDFs)
      allowed_formats: ["jpg", "jpeg", "png", "webp", "pdf"],
    }),
  });

const baseOptions = {
  limits: { fileSize: 10 * 1024 * 1024 }, // Max size: 10MB (increased for PDFs)
  fileFilter,
};

const uploadProfile = multer({
  storage: buildStorage("bharat-yatra/profile"),
  ...baseOptions,
});

const uploadDestination = multer({
  storage: buildDynamicStorage(),
  ...baseOptions,
});

module.exports = { uploadProfile, uploadDestination };
