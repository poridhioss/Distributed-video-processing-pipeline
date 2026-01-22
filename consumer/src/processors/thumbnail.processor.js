const { spawn } = require('child_process');
const path = require('path');
const { downloadFile, uploadSpriteSheet, uploadMetadata } = require('../services/minio.service');
const {
  ensureDirectory,
  deleteFile,
  deleteDirectory,
  listFiles
} = require('../utils/cleanup');
const logger = require('../utils/logger');
const { getVideoDuration } = require('../utils/video-metadata');
const { generateSpriteSheet } = require('./sprite-generator');
const { generateMetadata } = require('./metadata-generator');
const {
  updateVideoToProcessing,
  updateVideoToCompleted,
  updateVideoToFailed
} = require('../services/database.service');

// Directories for temporary storage
const DOWNLOAD_DIR = '/tmp/downloads';
const FRAMES_DIR = '/tmp/frames';
const SPRITES_DIR = '/tmp/sprites';

/**
 * Process video: download, extract frames, create sprite sheet, generate metadata
 * @param {Object} task - Task message from queue
 */
const processVideo = async (task) => {
  const { videoId, bucket, key, originalName } = task;
  const videoPath = path.join(DOWNLOAD_DIR, `${videoId}.mp4`);
  const framesDir = path.join(FRAMES_DIR, videoId);
  const spritesDir = path.join(SPRITES_DIR, videoId);
  const spritePath = path.join(spritesDir, 'sprite_0.jpg');

  try {
    logger.info('Starting video processing', {
      videoId,
      key,
      originalName
    });

    // Step 1: Update database status to 'processing'
    await updateVideoToProcessing(videoId);

    // Step 2: Ensure directories exist
    ensureDirectory(DOWNLOAD_DIR);
    ensureDirectory(framesDir);
    ensureDirectory(spritesDir);

    // Step 3: Download video from MinIO
    logger.info('Downloading video from MinIO', { videoId, key });
    const downloadResult = await downloadFile(key, videoPath);
    logger.info('Video downloaded', {
      videoId,
      size: downloadResult.size,
      path: videoPath
    });

    // Step 4: Get video duration using FFprobe
    logger.info('Detecting video duration', { videoId });
    const videoDuration = await getVideoDuration(videoPath);
    logger.info('Video duration detected', {
      videoId,
      duration: videoDuration.toFixed(2)
    });

    // Step 5: Extract frames using FFmpeg (1 frame per 2 seconds)
    logger.info('Extracting frames with FFmpeg', { videoId });
    const frameCount = await extractFrames(videoPath, framesDir);
    logger.info('Frames extracted', {
      videoId,
      count: frameCount
    });

    // Step 6: Validate frames
    const frames = listFiles(framesDir).filter(f => f.endsWith('.jpg'));
    if (frames.length === 0) {
      throw new Error('No frames were generated');
    }

    logger.info('Frame extraction completed', {
      videoId,
      frameCount: frames.length,
      frames: frames.slice(0, 5) // Log first 5
    });

    // Step 7: Generate sprite sheet (10x10 grid)
    logger.info('Generating sprite sheet', { videoId });
    const spriteResult = await generateSpriteSheet(framesDir, spritePath, {
      columns: 10,
      rows: 10,
      maxFrames: 100 // Single sprite only
    });
    logger.info('Sprite sheet generated', {
      videoId,
      frameCount: spriteResult.frameCount,
      grid: `${spriteResult.columns}x${spriteResult.rows}`,
      path: spritePath
    });

    // Step 8: Upload sprite sheet to MinIO
    logger.info('Uploading sprite sheet to MinIO', { videoId });
    const spriteUploadResult = await uploadSpriteSheet(videoId, spritePath, 0);
    logger.info('Sprite sheet uploaded', {
      videoId,
      size: spriteUploadResult.size,
      key: spriteUploadResult.key
    });

    // Step 9: Generate metadata.json
    logger.info('Generating metadata', { videoId });
    const metadata = generateMetadata({
      videoId,
      videoDuration,
      frameCount: spriteResult.frameCount,
      thumbnailInterval: 2,
      thumbnailWidth: 160,
      thumbnailHeight: 90,
      columns: 10,
      rows: 10,
      spriteSheetPath: spriteUploadResult.key
    });

    // Step 10: Upload metadata to MinIO
    logger.info('Uploading metadata to MinIO', { videoId });
    const metadataUploadResult = await uploadMetadata(videoId, metadata);
    logger.info('Metadata uploaded', {
      videoId,
      size: metadataUploadResult.size,
      key: metadataUploadResult.key
    });

    // Step 11: Update database status to 'completed'
    await updateVideoToCompleted(videoId, {
      thumbnailCount: spriteResult.frameCount,
      videoDuration: videoDuration,
      spriteSheetPath: spriteUploadResult.key,
      metadataPath: metadataUploadResult.key
    });

    // Step 12: Cleanup local files
    deleteFile(videoPath);
    deleteDirectory(framesDir);
    deleteDirectory(spritesDir);

    logger.info('Video processing completed successfully', {
      videoId,
      frameCount: spriteResult.frameCount,
      duration: videoDuration.toFixed(2)
    });

    return {
      videoId,
      frameCount: spriteResult.frameCount,
      videoDuration,
      spriteSize: spriteUploadResult.size,
      metadataSize: metadataUploadResult.size
    };

  } catch (error) {
    logger.error('Video processing failed', {
      videoId,
      error: error.message,
      stack: error.stack
    });

    // Update database status to 'failed'
    try {
      await updateVideoToFailed(videoId, error.message);
    } catch (dbError) {
      logger.error('Failed to update video status to failed', {
        videoId,
        error: dbError.message
      });
    }

    // Cleanup on failure
    deleteFile(videoPath);
    deleteDirectory(framesDir);
    deleteDirectory(spritesDir);

    throw error;
  }
};

/**
 * Extract frames using FFmpeg (1 frame per 2 seconds, 160x90 resolution)
 * @param {string} videoPath - Path to video file
 * @param {string} outputDir - Directory to store frames
 * @returns {Promise<number>} Number of frames extracted
 */
const extractFrames = (videoPath, outputDir) => {
  return new Promise((resolve, reject) => {
    const outputPattern = path.join(outputDir, 'frame_%04d.jpg');

    const ffmpegArgs = [
      '-i', videoPath,                 // Input file
      '-vf', 'fps=1/2,scale=160:90',   // 1 frame per 2 seconds, scale to 160x90
      '-q:v', '2',                     // JPEG quality (2 is high quality)
      outputPattern                    // Output pattern
    ];

    logger.debug('Running FFmpeg to extract frames', {
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
        logger.info('FFmpeg frame extraction completed', {
          exitCode: code,
          frameCount: frames.length
        });
        resolve(frames.length);
      } else {
        // Error - Log full stderr for debugging
        logger.error('FFmpeg frame extraction failed', {
          exitCode: code,
          stderr: stderr,
          command: `ffmpeg ${ffmpegArgs.join(' ')}`
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
  extractFrames
};
