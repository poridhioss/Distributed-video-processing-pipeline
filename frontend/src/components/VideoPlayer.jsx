import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { getVideoStreamUrl, getVideoStatus } from '../services/api';
import useVideoMetadata from '../hooks/useVideoMetadata';
import useSpritePreload from '../hooks/useSpritePreload';
import CustomTimeline from './CustomTimeline';
import '../styles/VideoPlayer.css';

const VideoPlayer = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [videoStatus, setVideoStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);

  const { metadata, loading: metadataLoading, error: metadataError } = useVideoMetadata(videoId);
  const { spritesLoaded, progress: spriteProgress, error: spriteError } = useSpritePreload(videoId, metadata);

  // Check video status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await getVideoStatus(videoId);
        setVideoStatus(status);

        if (status.status !== 'completed') {
          setStatusError(`Video is ${status.status}. Please wait for processing to complete.`);
        }
      } catch (err) {
        console.error('Failed to fetch video status:', err);
        setStatusError('Failed to load video status');
      }
    };

    checkStatus();
  }, [videoId]);

  // Initialize Video.js player
  useEffect(() => {
    if (!videoRef.current || videoStatus?.status !== 'completed') return;

    const videoElement = videoRef.current;

    // Initialize player
    const player = videojs(videoElement, {
      controls: true,
      autoplay: false,
      preload: 'auto',
      fluid: true,
      controlBar: {
        progressControl: false, // Disable default progress bar (we use custom timeline)
        children: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'fullscreenToggle',
        ],
      },
    });

    playerRef.current = player;

    // Set video source
    player.src({
      src: getVideoStreamUrl(videoId),
      type: 'video/mp4',
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [videoId, videoStatus]);

  const isLoading = metadataLoading || !spritesLoaded;
  const hasError = metadataError || spriteError || statusError;

  if (hasError) {
    return (
      <div className="player-container">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>Failed to load video</h2>
          <p>{metadataError || spriteError || statusError}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Back to Video List
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="player-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h2>Loading video...</h2>
          <div className="loading-details">
            {metadataLoading && <p>✓ Loading metadata...</p>}
            {!metadataLoading && metadata && (
              <>
                <p>✓ Metadata loaded</p>
                <p>
                  {spritesLoaded 
                    ? '✓ Sprites preloaded' 
                    : `⏳ Preloading sprites... ${spriteProgress}%`}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="player-container">
      <div className="player-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back to Videos
        </button>
        <h2 className="video-title">{videoStatus?.original_name || 'Video Player'}</h2>
      </div>

      <div className="video-player-wrapper">
        <div data-vjs-player>
          <video
            ref={videoRef}
            className="video-js vjs-big-play-centered"
          />
        </div>

        <CustomTimeline
          videoId={videoId}
          videoRef={videoRef}
          metadata={metadata}
          spritesLoaded={spritesLoaded}
        />
      </div>

      <div className="video-info">
        <div className="info-item">
          <span className="info-label">Duration:</span>
          <span className="info-value">
            {metadata && `${Math.floor(metadata.videoDuration / 60)}:${String(Math.floor(metadata.videoDuration % 60)).padStart(2, '0')}`}
          </span>
        </div>
        <div className="info-item">
          <span className="info-label">Thumbnails:</span>
          <span className="info-value">{metadata?.totalThumbnails || 0}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Sprite Sheets:</span>
          <span className="info-value">{metadata?.spriteSheets?.length || 0}</span>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
