const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');
const { listFiles } = require('../utils/cleanup');

/**
 * Generate sprite sheet from individual frames using FFmpeg tile filter
 * @param {string} framesDir - Directory containing individual frame images
 * @param {string} outputPath - Path for output sprite sheet
 * @param {Object} options - Sprite generation options
 * @param {number} options.columns - Number of columns in sprite grid (default: 10)
 * @param {number} options.rows - Number of rows in sprite grid (default: 10)
 * @param {number} options.maxFrames - Maximum frames to include (default: 100)
 * @returns {Promise<Object>} Sprite generation result
 */
const generateSpriteSheet = (framesDir, outputPath, options = {}) => {
  return new Promise((resolve, reject) => {
    const columns = options.columns || 10;
    const rows = options.rows || 10;
    const maxFrames = options.maxFrames || 100;

    // List all frame files
    const frames = listFiles(framesDir)
      .filter(f => f.endsWith('.jpg'))
      .sort()
      .slice(0, maxFrames); // Limit to max frames

    if (frames.length === 0) {
      reject(new Error('No frames found to create sprite sheet'));
      return;
    }

    const inputPattern = path.join(framesDir, 'frame_%04d.jpg');

    // FFmpeg command to create sprite sheet using tile filter
    const ffmpegArgs = [
      '-start_number', '1',
      '-i', inputPattern,
      '-frames:v', frames.length.toString(),
      '-filter_complex', `tile=${columns}x${rows}`,
      '-y', // Overwrite output file if exists
      outputPath
    ];

    logger.debug('Running FFmpeg to create sprite sheet', {
      command: 'ffmpeg',
      args: ffmpegArgs.join(' '),
      frameCount: frames.length,
      grid: `${columns}x${rows}`
    });

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        logger.info('Sprite sheet created successfully', {
          output: outputPath,
          frameCount: frames.length,
          grid: `${columns}x${rows}`
        });

        resolve({
          spritePath: outputPath,
          frameCount: frames.length,
          columns,
          rows
        });
      } else {
        logger.error('FFmpeg sprite generation failed', {
          exitCode: code,
          stderr,
          command: `ffmpeg ${ffmpegArgs.join(' ')}`
        });
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (error) => {
      logger.error('FFmpeg process error', {
        error: error.message,
        output: outputPath
      });
      reject(error);
    });
  });
};

/**
 * Calculate sprite sheet dimensions
 * @param {number} frameCount - Total number of frames
 * @param {number} frameWidth - Width of individual frame
 * @param {number} frameHeight - Height of individual frame
 * @param {number} columns - Number of columns
 * @param {number} rows - Number of rows
 * @returns {Object} Sprite dimensions
 */
const calculateSpriteDimensions = (frameCount, frameWidth, frameHeight, columns, rows) => {
  // Calculate actual rows needed (might be less than max rows)
  const actualRows = Math.ceil(frameCount / columns);

  return {
    spriteWidth: frameWidth * columns,
    spriteHeight: frameHeight * actualRows,
    actualRows,
    columns
  };
};

module.exports = {
  generateSpriteSheet,
  calculateSpriteDimensions
};
