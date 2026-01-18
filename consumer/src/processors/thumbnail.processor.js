const { spawn } = require('child_process');
const path = require('path');
const { downloadFile } = require('../services/minio.service');
const { 
  ensureDirectory, 
  deleteFile, 
  deleteDirectory, 
  listFiles,
  getFileSize 
} = require('../utils/cleanup');
const logger = require('../utils/logger');

// Directories for temporary storage
const DOWNLOAD_DIR = '/tmp/downloads';
const FRAMES_DIR = '/tmp/frames';

/**
 * Process video: download and extract thumbnails
 * @param {Object} task - Task message from queue
 */
const processVideo = async (task) => {
  const { videoId, bucket, key, originalName } = task;
  
  // Define paths
  const videoPath = path.join(DOWNLOAD_DIR, `${videoId}.mp4`);
  const framesDir = path.join(FRAMES_DIR, videoId);
  
  try {
    logger.info('Starting video processing', {
      videoId,
      key,
      originalName
    });
    
    // Step 1: Ensure directories exist
    ensureDirectory(DOWNLOAD_DIR);
    ensureDirectory(framesDir);
    
    // Step 2: Download video from MinIO
    logger.info('Downloading video from MinIO', { videoId, key });
    const downloadResult = await downloadFile(key, videoPath);
    logger.info('Video downloaded', {
      videoId,
      size: downloadResult.size,
      path: videoPath
    });
    
    // Step 3: Extract thumbnails using FFmpeg
    logger.info('Extracting thumbnails with FFmpeg', { videoId });
    const thumbnailCount = await extractThumbnails(videoPath, framesDir);
    logger.info('Thumbnails extracted', {
      videoId,
      count: thumbnailCount
    });
    
    // Step 4: Validate thumbnails
    const thumbnails = listFiles(framesDir);
    if (thumbnails.length === 0) {
      throw new Error('No thumbnails were generated');
    }
    
    logger.info('Thumbnail extraction completed', {
      videoId,
      thumbnailCount: thumbnails.length,
      thumbnails: thumbnails.slice(0, 5) // Log first 5
    });
    
    // Step 5: Cleanup (we'll upload to MinIO in Lab 3)
    deleteFile(videoPath);
    // Keep frames for now (will upload in Lab 3)
    
    return {
      videoId,
      thumbnailCount: thumbnails.length,
      framesDir
    };
    
  } catch (error) {
    logger.error('Video processing failed', {
      videoId,
      error: error.message,
      stack: error.stack
    });
    
    // Cleanup on failure
    deleteFile(videoPath);
    deleteDirectory(framesDir);
    
    throw error;
  }
};

/**
 * Extract thumbnails using FFmpeg
 * @param {string} videoPath - Path to video file
 * @param {string} outputDir - Directory to store thumbnails
 * @returns {Promise<number>} Number of frames extracted
 */
const extractThumbnails = (videoPath, outputDir) => {
  return new Promise((resolve, reject) => {
    // FFmpeg command:
    // -i: input file
    // -vf fps=1/2: extract 1 frame per 2 seconds
    // -q:v 2: JPEG quality (2 = high quality)
    // frame_%04d.jpg: output pattern (frame_0001.jpg, frame_0002.jpg, ...)
    
    const outputPattern = path.join(outputDir, 'frame_%04d.jpg');
    
    const ffmpegArgs = [
      '-i', videoPath,           // Input file
      '-vf', 'fps=1/2',          // 1 frame per 2 seconds
      '-q:v', '2',               // JPEG quality
      outputPattern              // Output pattern
    ];
    
    logger.debug('Running FFmpeg', {
      command: 'ffmpeg',
      args: ffmpegArgs.join(' ')
    });
    
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    
    let stderr = '';
    
    // Capture FFmpeg output (mostly goes to stderr)
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Handle completion
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        // Success - count generated frames
        const frames = listFiles(outputDir).filter(f => f.endsWith('.jpg'));
        logger.info('FFmpeg completed successfully', {
          exitCode: code,
          frameCount: frames.length
        });
        resolve(frames.length);
      } else {
        // Error
        logger.error('FFmpeg failed', {
          exitCode: code,
          stderr: stderr.substring(0, 500) // Log first 500 chars
        });
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
    
    // Handle errors
    ffmpeg.on('error', (error) => {
      logger.error('FFmpeg process error', { error: error.message });
      reject(error);
    });
  });
};

module.exports = {
  processVideo,
  extractThumbnails
};