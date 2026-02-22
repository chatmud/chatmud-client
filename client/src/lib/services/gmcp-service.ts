import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { gmcpState } from '../state/gmcp.svelte';
import { channelHistoryState } from '../state/channel-history.svelte';
import { outputState } from '../state/output.svelte';
import { mediaService } from './media-service';
import type { ClientRender } from '../types/gmcp';
import type {
  MediaDefaultOptions,
  MediaLoadOptions,
  MediaPlayOptions,
  MediaStopOptions,
} from '../types/media';

const DOMPURIFY_CONFIG = {
  RETURN_TRUSTED_TYPE: false as const,
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a', 'img',
    'strong', 'em', 'code', 'pre', 'blockquote',
    'span', 'div',
    'dl', 'dt', 'dd',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'title', 'colspan', 'rowspan'],
};

// Force links to open in new tab
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

class GmcpService {
  // Called by telnet-negotiator when a GMCP subnegotiation is received
  handleMessage(module: string, data: unknown): void {
    if (typeof data !== 'object' || data === null) {
      gmcpState.updateModule(module, data);
      return;
    }

    const obj = data as Record<string, unknown>;

    // Route channel text to channel history buffers
    switch (module) {
      case 'Comm.Channel.Text': {
        const { channel, talker, text } = obj as { channel: string; talker: string; text: string };
        if (channel && text) {
          channelHistoryState.addChannelMessage(channel, talker || '', text);
        }
        // Fall through to update gmcpState as well
        break;
      }
      case 'Client.Media.Default':
        if (typeof obj.url === 'string') {
          mediaService.handleDefault(obj as unknown as MediaDefaultOptions);
        }
        return;
      case 'Client.Media.Load':
        if (typeof obj.name === 'string') {
          mediaService.handleLoad(obj as unknown as MediaLoadOptions);
        }
        return;
      case 'Client.Media.Play':
        if (typeof obj.name === 'string') {
          mediaService.handlePlay(obj as unknown as MediaPlayOptions);
        }
        return;
      case 'Client.Media.Stop':
        mediaService.handleStop(obj as unknown as MediaStopOptions);
        return;
      case 'Client.Render': {
        const render = obj as ClientRender;
        let rawHtml: string | undefined;
        if (typeof render.html === 'string') {
          rawHtml = render.html;
        } else if (typeof render.markdown === 'string') {
          rawHtml = marked.parse(render.markdown, { async: false }) as string;
        }
        if (rawHtml) {
          const sanitized = DOMPurify.sanitize(rawHtml, DOMPURIFY_CONFIG);
          const caption = typeof render.caption === 'string' ? render.caption : undefined;
          outputState.addHtmlLine(sanitized, caption);
        }
        return;
      }
    }

    // All other GMCP modules go to state
    gmcpState.updateModule(module, data);
  }
}

export const gmcpService = new GmcpService();
