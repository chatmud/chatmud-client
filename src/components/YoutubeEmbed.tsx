import React, { useState, useEffect } from 'react';
import './YoutubeEmbed.css';

interface YoutubeEmbedProps {
  videoId: string;
  url: string; // Original URL for fallback link
  muted?: boolean; // Global mute state
}

/**
 * Extracts YouTube video ID from various URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 */
export function extractYoutubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export const YoutubeEmbed: React.FC<YoutubeEmbedProps> = ({ videoId, url, muted = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [videoTitle, setVideoTitle] = useState<string>('YouTube Video');

  // Fetch video title from YouTube oEmbed API
  useEffect(() => {
    fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
      .then(res => res.json())
      .then(data => {
        if (data.title) {
          setVideoTitle(data.title);
        }
      })
      .catch(() => {
        // Silently fail, keep default title
      });
  }, [videoId]);

  // Build iframe src with mute parameter
  const iframeSrc = `https://www.youtube.com/embed/${videoId}${muted ? '?mute=1' : ''}`;

  if (!isExpanded) {
    return (
      <div className="youtube-embed-container youtube-embed-collapsed">
        <button
          className="youtube-embed-expand-button"
          onClick={() => setIsExpanded(true)}
          aria-label="Expand YouTube video"
        >
          <span className="youtube-icon">▶️</span>
          <span className="youtube-title">{videoTitle}</span>
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="youtube-embed-external-link"
          title="Open in YouTube"
        >
          ↗
        </a>
      </div>
    );
  }

  return (
    <div className="youtube-embed-container youtube-embed-expanded">
      <div className="youtube-embed-header">
        <span className="youtube-title">{videoTitle}</span>
        <button
          className="youtube-embed-collapse-button"
          onClick={() => setIsExpanded(false)}
          aria-label="Collapse YouTube video"
        >
          ✕
        </button>
      </div>
      <iframe
        className="youtube-embed-iframe"
        src={iframeSrc}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      <div className="youtube-embed-link">
        <a href={url} target="_blank" rel="noreferrer">
          Watch on YouTube ↗
        </a>
      </div>
    </div>
  );
};

export default YoutubeEmbed;
