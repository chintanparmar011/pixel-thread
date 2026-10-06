const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isAudio =
      file.mimetype.startsWith("audio/") ||
      (file.originalname && file.originalname.match(/\.(webm|mp3|wav|m4a|ogg)$/i));
    return {
      folder: "pixelthread",
      resource_type: isAudio ? "video" : "auto",
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

module.exports = upload;