import { getSpriteUrl } from '../services/api';
import { formatTime } from '../utils/timeFormat';
import '../styles/VideoPlayer.css';

const TimelinePreview = ({ videoId, metadata, hoveredTime, position }) => {
  if (!hoveredTime || !metadata || !position) return null;

  // Find the closest thumbnail for the hovered time
  const thumbnail = metadata.thumbnails.reduce((prev, curr) => {
    return Math.abs(curr.time - hoveredTime) < Math.abs(prev.time - hoveredTime)
      ? curr
      : prev;
  });

  if (!thumbnail) return null;

  const sprite = metadata.spriteSheets[thumbnail.spriteIndex];
  const spriteUrl = getSpriteUrl(videoId, thumbnail.spriteIndex);

  return (
    <div
      className="timeline-preview"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div
        className="preview-thumbnail"
        style={{
          width: `${metadata.thumbnailWidth}px`,
          height: `${metadata.thumbnailHeight}px`,
          backgroundImage: `url(${spriteUrl})`,
          backgroundSize: `${metadata.spriteWidth}px ${metadata.spriteHeight}px`,
          backgroundPosition: `-${thumbnail.x}px -${thumbnail.y}px`,
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="preview-time">{formatTime(thumbnail.time)}</div>
    </div>
  );
};

export default TimelinePreview;
