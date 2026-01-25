import videojs from 'video.js';
import { getSpriteUrl } from '../services/api';
import { formatTime } from '../utils/timeFormat';

const Component = videojs.getComponent('Component');

/**
 * Video.js plugin for displaying thumbnail previews on progress bar hover
 */
class ThumbnailPreview extends Component {
  constructor(player, options) {
    super(player, options);
    
    this.player = player;
    this.tooltipContainer = null;
    this.thumbnailImage = null;
    this.timeDisplay = null;
    this.progressControl = null;
    this.isVisible = false;
    
    // Bind methods
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    
    // Wait for player ready
    player.ready(() => {
      this.initialize();
    });
  }

  /**
   * Initialize the thumbnail preview component
   */
  initialize() {
    // Get the progress control element
    this.progressControl = this.player.controlBar.progressControl;
    
    if (!this.progressControl) {
      console.warn('Progress control not found. Thumbnail preview disabled.');
      return;
    }

    // Create tooltip elements
    this.createTooltip();
    
    // Attach event listeners to the progress control
    const progressHolder = this.progressControl.el();
    progressHolder.addEventListener('mousemove', this.handleMouseMove);
    progressHolder.addEventListener('mouseleave', this.handleMouseLeave);
    
    console.log('Thumbnail preview plugin initialized');
  }

  /**
   * Create the tooltip DOM structure
   */
  createTooltip() {
    // Create container
    this.tooltipContainer = document.createElement('div');
    this.tooltipContainer.className = 'vjs-thumbnail-preview';
    this.tooltipContainer.style.display = 'none';
    
    // Create thumbnail image container
    this.thumbnailImage = document.createElement('div');
    this.thumbnailImage.className = 'vjs-thumbnail-image';
    
    // Create time display
    this.timeDisplay = document.createElement('div');
    this.timeDisplay.className = 'vjs-thumbnail-time';
    
    // Assemble tooltip
    this.tooltipContainer.appendChild(this.thumbnailImage);
    this.tooltipContainer.appendChild(this.timeDisplay);
    
    // Append to player
    this.player.el().appendChild(this.tooltipContainer);
  }

  /**
   * Handle mouse movement over progress bar
   */
  handleMouseMove(event) {
    const metadata = this.player.thumbnailMetadata;
    const spritesLoaded = this.player.spritesLoaded;
    
    // Check if we have required data
    if (!metadata || !spritesLoaded || !this.player.duration()) {
      this.hideTooltip();
      return;
    }

    const progressHolder = this.progressControl.el();
    const rect = progressHolder.getBoundingClientRect();
    
    // Calculate hover position and time
    const mouseX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, mouseX / rect.width));
    const hoverTime = percentage * this.player.duration();
    
    // Find the closest thumbnail
    const thumbnail = this.findThumbnailForTime(hoverTime, metadata);
    
    if (thumbnail) {
      this.updateThumbnail(thumbnail, metadata, hoverTime);
      this.positionTooltip(event.clientX, rect);
      this.showTooltip();
    } else {
      this.hideTooltip();
    }
  }

  /**
   * Find the closest thumbnail for a given time
   */
  findThumbnailForTime(time, metadata) {
    if (!metadata.thumbnails || metadata.thumbnails.length === 0) {
      return null;
    }

    return metadata.thumbnails.reduce((prev, curr) => {
      return Math.abs(curr.time - time) < Math.abs(prev.time - time)
        ? curr
        : prev;
    });
  }

  /**
   * Update thumbnail image and display
   */
  updateThumbnail(thumbnail, metadata, hoverTime) {
    const videoId = this.player.videoId;
    const spriteUrl = getSpriteUrl(videoId, thumbnail.spriteIndex);
    
    const spriteWidth = metadata.spriteWidth;
    const spriteHeight = metadata.spriteHeight;
    const thumbnailWidth = metadata.thumbnailWidth;
    const thumbnailHeight = metadata.thumbnailHeight;
    
    // Update thumbnail image
    this.thumbnailImage.style.width = `${thumbnailWidth}px`;
    this.thumbnailImage.style.height = `${thumbnailHeight}px`;
    this.thumbnailImage.style.backgroundImage = `url("${spriteUrl}")`;
    this.thumbnailImage.style.backgroundSize = `${spriteWidth}px ${spriteHeight}px`;
    this.thumbnailImage.style.backgroundPosition = `-${thumbnail.x}px -${thumbnail.y}px`;
    this.thumbnailImage.style.backgroundRepeat = 'no-repeat';
    
    // Update time display
    this.timeDisplay.textContent = formatTime(hoverTime);
  }

  /**
   * Position the tooltip relative to cursor
   */
  positionTooltip(mouseX, progressRect) {
    const metadata = this.player.thumbnailMetadata;
    if (!metadata) return;
    
    const tooltipWidth = metadata.thumbnailWidth;
    const tooltipHeight = metadata.thumbnailHeight + 40; // Include time display
    
    // Calculate horizontal position (centered on cursor)
    let left = mouseX - tooltipWidth / 2;
    
    // Keep within viewport bounds
    const minLeft = 10;
    const maxLeft = window.innerWidth - tooltipWidth - 10;
    left = Math.max(minLeft, Math.min(maxLeft, left));
    
    // Position above the progress bar
    const top = progressRect.top - tooltipHeight - 10;
    
    this.tooltipContainer.style.left = `${left}px`;
    this.tooltipContainer.style.top = `${top}px`;
  }

  /**
   * Show the tooltip
   */
  showTooltip() {
    if (!this.isVisible) {
      this.tooltipContainer.style.display = 'flex';
      this.isVisible = true;
    }
  }

  /**
   * Hide the tooltip
   */
  hideTooltip() {
    if (this.isVisible) {
      this.tooltipContainer.style.display = 'none';
      this.isVisible = false;
    }
  }

  /**
   * Handle mouse leaving progress bar
   */
  handleMouseLeave() {
    this.hideTooltip();
  }

  /**
   * Cleanup when component is disposed
   */
  dispose() {
    if (this.progressControl) {
      const progressHolder = this.progressControl.el();
      progressHolder.removeEventListener('mousemove', this.handleMouseMove);
      progressHolder.removeEventListener('mouseleave', this.handleMouseLeave);
    }
    
    if (this.tooltipContainer && this.tooltipContainer.parentNode) {
      this.tooltipContainer.parentNode.removeChild(this.tooltipContainer);
    }
    
    super.dispose();
  }
}

// Register the component with Video.js
videojs.registerComponent('ThumbnailPreview', ThumbnailPreview);

export default ThumbnailPreview;
