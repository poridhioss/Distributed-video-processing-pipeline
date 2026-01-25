import { useState, useRef, useEffect } from 'react';
import TimelinePreview from './TimelinePreview';
import '../styles/VideoPlayer.css';

const CustomTimeline = ({ videoId, videoRef, metadata, spritesLoaded }) => {
  const [hoveredTime, setHoveredTime] = useState(null);
  const [previewPosition, setPreviewPosition] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const timelineRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('durationchange', updateDuration);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('durationchange', updateDuration);
    };
  }, [videoRef]);

  const handleMouseMove = (e) => {
    if (!spritesLoaded || !metadata || !duration) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const time = percentage * duration;

    setHoveredTime(time);

    // Position preview above timeline, centered on cursor
    const previewWidth = metadata.thumbnailWidth;
    const previewHeight = metadata.thumbnailHeight + 30; // Include time label
    
    let previewX = e.clientX - previewWidth / 2;
    const previewY = rect.top - previewHeight - 10;

    // Keep preview within viewport bounds
    const minX = 10;
    const maxX = window.innerWidth - previewWidth - 10;
    previewX = Math.max(minX, Math.min(maxX, previewX));

    setPreviewPosition({ x: previewX, y: previewY });
  };

  const handleMouseLeave = () => {
    setHoveredTime(null);
    setPreviewPosition(null);
  };

  const handleClick = (e) => {
    if (!videoRef.current || !duration) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    videoRef.current.currentTime = percentage * duration;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="custom-timeline-container">
      <div
        ref={timelineRef}
        className="custom-timeline"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div className="timeline-track">
          <div
            className="timeline-progress"
            style={{ width: `${progressPercentage}%` }}
          />
          <div
            className="timeline-handle"
            style={{ left: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {spritesLoaded && (
        <TimelinePreview
          videoId={videoId}
          metadata={metadata}
          hoveredTime={hoveredTime}
          position={previewPosition}
        />
      )}
    </div>
  );
};

export default CustomTimeline;
