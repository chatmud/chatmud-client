import React from 'react';
import './YoutubeEmbed.css';

interface YoutubeEmbedProps {
  videoId: string;
  url: string; // Original URL for fallback link
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

export const YoutubeEmbed: React.FC<YoutubeEmbedProps> = ({ videoId, url }) => {
  return (
    <div className="youtube-embed-container">
      <iframe
        className="youtube-embed-iframe"
        src={`https://www.youtube.com/embed/${videoId}`}
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
