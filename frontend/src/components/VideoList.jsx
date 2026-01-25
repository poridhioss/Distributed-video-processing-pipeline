import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listVideos } from '../services/api';
import '../styles/App.css';

const VideoList = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const statusFilter = filter === 'all' ? null : filter;
      const data = await listVideos(statusFilter);
      setVideos(data.videos);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch videos:', err);
      setError('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [filter]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (videos.some(v => v.status === 'processing' || v.status === 'uploaded')) {
        fetchVideos();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [videos]);

  const getStatusBadge = (status) => {
    const badges = {
      uploaded: { class: 'badge-info', text: 'Uploaded', icon: '📤' },
      processing: { class: 'badge-warning', text: 'Processing', icon: '⚙️' },
      completed: { class: 'badge-success', text: 'Completed', icon: '✓' },
      failed: { class: 'badge-error', text: 'Failed', icon: '✕' },
    };
    const badge = badges[status] || badges.uploaded;
    return (
      <span className={`status-badge ${badge.class}`}>
        <span className="badge-icon">{badge.icon}</span>
        {badge.text}
      </span>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleVideoClick = (video) => {
    console.log(video)
    if (video.status === 'completed') {
      navigate(`/watch/${video.videoId}`);
    }
  };

  if (loading && videos.length === 0) {
    return (
      <div className="video-list-container">
        <div className="loading-spinner">Loading videos...</div>
      </div>
    );
  }

  return (
    <div className="video-list-container">
      <div className="video-list-header">
        <h1>Video Library</h1>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/upload')}
        >
          + Upload New Video
        </button>
      </div>

      <div className="filter-tabs">
        {['all', 'completed', 'processing', 'uploaded', 'failed'].map((tab) => (
          <button
            key={tab}
            className={`filter-tab ${filter === tab ? 'active' : ''}`}
            onClick={() => setFilter(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {videos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📹</div>
          <h2>No videos found</h2>
          <p>Upload your first video to get started</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/upload')}
          >
            Upload Video
          </button>
        </div>
      ) : (
        <div className="video-grid">
          {videos.map((video) => (
            <div
              key={video.videoId}
              className={`video-card ${video.status === 'completed' ? 'clickable' : ''}`}
              onClick={() => handleVideoClick(video)}
            >
              <div className="video-card-header">
                <div className="video-icon">🎥</div>
                {getStatusBadge(video.status)}
              </div>

              <div className="video-card-body">
                <h3 className="video-title" title={video.originalName}>
                  {video.originalName}
                </h3>
                <div className="video-meta">
                  <p className="video-info">
                    <span className="meta-label">Uploaded:</span>
                    <span className="meta-value">{formatDate(video.createdAt)}</span>
                  </p>
                  {video.video_duration && (
                    <p className="video-info">
                      <span className="meta-label">Duration:</span>
                      <span className="meta-value">
                        {Math.floor(video.videoDuration / 60)}:{String(Math.floor(video.videoDuration % 60)).padStart(2, '0')}
                      </span>
                    </p>
                  )}
                  {video.thumbnail_count > 0 && (
                    <p className="video-info">
                      <span className="meta-label">Thumbnails:</span>
                      <span className="meta-value">{video.thumbnailCount}</span>
                    </p>
                  )}
                </div>

                {video.error && (
                  <p className="error-text">{video.error}</p>
                )}
              </div>

              {video.status === 'completed' && (
                <div className="video-card-footer">
                  <button className="btn-play">▶ Play</button>
                </div>
              )}

              {video.status === 'processing' && (
                <div className="video-card-footer">
                  <div className="processing-indicator">
                    <div className="spinner"></div>
                    Processing...
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoList;
