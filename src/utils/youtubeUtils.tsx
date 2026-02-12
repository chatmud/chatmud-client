import React from 'react';
import YoutubeEmbed, { extractYoutubeVideoId } from '../components/YoutubeEmbed';

/**
 * Processes HTML content to detect YouTube URLs and replace them with embeds
 */
export function processYoutubeLinksInHtml(html: string): React.ReactElement[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements: React.ReactElement[] = [];
  let keyCounter = 0;

  // Find all links in the HTML
  const links = doc.querySelectorAll('a[href]');
  const youtubeLinks: HTMLAnchorElement[] = [];

  links.forEach((link) => {
    const href = (link as HTMLAnchorElement).href;
    const videoId = extractYoutubeVideoId(href);

    if (videoId) {
      youtubeLinks.push(link as HTMLAnchorElement);
    }
  });

  // If no YouTube links found, return original HTML
  if (youtubeLinks.length === 0) {
    return [<div key="html-content" dangerouslySetInnerHTML={{ __html: html }} />];
  }

  // Process the body, replacing YouTube links with embeds
  const bodyElement = doc.body;
  let currentHtml = '';

  const processNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'A') {
      const linkElement = node as HTMLAnchorElement;
      const videoId = extractYoutubeVideoId(linkElement.href);

      if (videoId) {
        // Add accumulated HTML before this embed
        if (currentHtml.trim()) {
          elements.push(
            <div key={`html-${keyCounter++}`} dangerouslySetInnerHTML={{ __html: currentHtml }} />
          );
          currentHtml = '';
        }

        // Add YouTube embed
        elements.push(
          <YoutubeEmbed key={`youtube-${keyCounter++}`} videoId={videoId} url={linkElement.href} />
        );
      } else {
        // Not a YouTube link, add to accumulated HTML
        currentHtml += linkElement.outerHTML;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Check if this element contains YouTube links
      const hasYoutubeChild = Array.from((node as HTMLElement).querySelectorAll('a[href]')).some(link => {
        return extractYoutubeVideoId((link as HTMLAnchorElement).href) !== null;
      });

      if (hasYoutubeChild) {
        // Process children individually
        Array.from(node.childNodes).forEach(processNode);
      } else {
        // No YouTube links in this element, add it as-is
        currentHtml += (node as HTMLElement).outerHTML;
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      currentHtml += node.textContent || '';
    }
  };

  Array.from(bodyElement.childNodes).forEach(processNode);

  // Add any remaining HTML
  if (currentHtml.trim()) {
    elements.push(
      <div key={`html-${keyCounter++}`} dangerouslySetInnerHTML={{ __html: currentHtml }} />
    );
  }

  return elements.length > 0 ? elements : [<div key="html-content" dangerouslySetInnerHTML={{ __html: html }} />];
}
