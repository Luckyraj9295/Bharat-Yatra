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
    params: (req, file) => {
      const isBrochure = file.fieldname === "brochure";
      
      console.log('📤 Uploading file:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        isBrochure
      });
      
      // Determine if file is PDF
      const isPdf = file.mimetype === 'application/pdf';
      
      // For brochures, ensure .pdf extension is preserved
      let config = {
        folder: isBrochure
          ? "bharat-yatra/brochures"
          : "bharat-yatra/destinations",
        // Use 'raw' for PDFs, 'image' for image brochures
        resource_type: (isBrochure && isPdf) ? "raw" : "image",
        type: "upload",
        // Make raw files publicly accessible without authentication
        ...(isBrochure && isPdf && { 
          access_mode: "public"
        }),
        allowed_formats: ["jpg", "jpeg", "png", "webp", "pdf"],
      };
      
      if (isBrochure) {
        // For PDFs, create a unique public_id WITHOUT extension (Cloudinary adds it)
        // For images, let Cloudinary handle it normally
        if (file.mimetype === 'application/pdf') {
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(7);
          // Don't include .pdf in public_id - Cloudinary adds it automatically for raw files
          config.public_id = `brochure_${timestamp}_${randomStr}`;
          config.format = 'pdf'; // Explicitly set format
        } else {
          config.use_filename = false;
          config.unique_filename = true;
        }
      } else {
        config.use_filename = false;
        config.unique_filename = true;
      }
      
      return config;
    },
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
