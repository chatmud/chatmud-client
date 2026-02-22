import { gmcpState } from '../state/gmcp.svelte';
import { channelHistoryState } from '../state/channel-history.svelte';
import { mediaService } from './media-service';
import type {
  MediaDefaultOptions,
  MediaLoadOptions,
  MediaPlayOptions,
  MediaStopOptions,
} from '../types/media';

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
    }

    // All other GMCP modules go to state
    gmcpState.updateModule(module, data);
  }
}

export const gmcpService = new GmcpService();
