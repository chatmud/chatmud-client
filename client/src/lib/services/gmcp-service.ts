import { gmcpState } from '../state/gmcp.svelte';
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
    // Route Client.Media messages to media service
    switch (module) {
      case 'Client.Media.Default':
        mediaService.handleDefault(data as MediaDefaultOptions);
        return;
      case 'Client.Media.Load':
        mediaService.handleLoad(data as MediaLoadOptions);
        return;
      case 'Client.Media.Play':
        mediaService.handlePlay(data as MediaPlayOptions);
        return;
      case 'Client.Media.Stop':
        mediaService.handleStop(data as MediaStopOptions);
        return;
    }

    // All other GMCP modules go to state
    gmcpState.updateModule(module, data);
  }
}

export const gmcpService = new GmcpService();
