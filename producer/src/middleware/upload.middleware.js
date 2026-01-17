const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Create uploads directory if it doesn't exist
const UPLOAD_DIR = '/tmp/uploads';
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// File filter - validate file type
const fileFilter = (req, file, cb) => {
  const allowedMimes = (process.env.ALLOWED_MIME_TYPES || 'video/mp4,video/avi,video/mov,video/mkv')
    .split(',')
    .map(type => type.trim());
  
  if (allowedMimes.includes(file.mimetype)) {
    logger.info('File type accepted', {
      filename: file.originalname,
      mimetype: file.mimetype
    });
    cb(null, true);
  } else {
    logger.warn('File type rejected', {
      filename: file.originalname,
      mimetype: file.mimetype,
      allowed: allowedMimes
    });
    cb(new Error(`Invalid file type. Allowed types: ${allowedMimes.join(', ')}`), false);
  }
};

// configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10) * 1024 * 1024 // Default 500MB
  }
});

// Error handler
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large',
                message: `Maximum file size is ${process.env.MAX_FILE_SIZE || 524288000} bytes`
            });
        }
        return res.status(400).json({
            error: 'Upload error',
            message: err.message
        });
    } else if (err) {
        return res.status(400).json({
            error: 'Invalid file',
            message: err.message
        });
    }
    next();
};

module.exports = {
  upload,
  handleUploadError
};