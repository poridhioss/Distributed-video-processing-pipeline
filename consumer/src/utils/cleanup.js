const fs = require('fs');
const path = require('path');
const logger = require('./logger');


// Delete a file it it exists
const deleteFile = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.debug('File deleted', { path: filePath });
            return true;
        }
        return false;
    } catch (error) {
        logger.error('Error deleting file', { path: filePath, error: error.message });
        return false;
    }
}

// Delete a directory and its contents recursively
const deleteDirectory = (dirPath) => {
    try {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
            logger.debug('Directory deleted', { path: dirPath });
            return true;
        }

        return false;
    } catch (error) {
        logger.error('Error deleting directory', { path: dirPath, error: error.message });
        return false;
    }
}

// Create a directory if it doesn't exist
const ensureDirectory = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.debug('Directory created', { path: dirPath });
    }
    return true;
  } catch (error) {
    logger.error('Failed to create directory', {
      path: dirPath,
      error: error.message
    });
    return false;
  }
};

// Get list of files in a directory
const listFiles = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    return fs.readdirSync(dirPath);
  } catch (error) {
    logger.error('Failed to list files', {
      path: dirPath,
      error: error.message
    });
    return [];
  }
};

// Get file size in bytes
const getFileSize = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    logger.error('Failed to get file size', {
      path: filePath,
      error: error.message
    });
    return 0;
  }
};

module.exports = {
  deleteFile,
  deleteDirectory,
  ensureDirectory,
  listFiles,
  getFileSize
};