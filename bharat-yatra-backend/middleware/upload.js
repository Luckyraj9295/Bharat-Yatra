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
      
      // For brochures, ensure .pdf extension is preserved
      let config = {
        folder: isBrochure
          ? "bharat-yatra/brochures"
          : "bharat-yatra/destinations",
        resource_type: isBrochure ? "raw" : "image",
        type: "upload",
        access_mode: "public",
        // Disable authentication for public downloads
        ...(isBrochure && { 
          access_control: [{ access_type: "anonymous" }]
        }),
        allowed_formats: ["jpg", "jpeg", "png", "webp", "pdf"],
      };
      
      if (isBrochure) {
        // For PDFs, create a public_id with .pdf extension
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        config.public_id = `brochure_${timestamp}_${randomStr}.pdf`;
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
