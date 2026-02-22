import type {
  RoomInfo,
  CommChannel,
} from '../types/gmcp';

class GmcpState {
  roomInfo = $state<RoomInfo | null>(null);
  commChannel = $state<CommChannel | null>(null);

  updateModule(module: string, data: unknown): void {
    switch (module) {
      case 'Room.Info':
        this.roomInfo = data as RoomInfo;
        break;
      case 'Comm.Channel':
        this.commChannel = data as CommChannel;
        break;
    }
  }

  reset(): void {
    this.roomInfo = null;
    this.commChannel = null;
  }
}

export const gmcpState = new GmcpState();
