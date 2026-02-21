import type {
  CharBase,
  CharVitals,
  CharStats,
  CharMaxStats,
  CharStatus,
  CharWorth,
  RoomInfo,
  CommChannel,
  GroupMember,
} from '../types/gmcp';

class GmcpState {
  charBase = $state<CharBase | null>(null);
  charVitals = $state<CharVitals | null>(null);
  charStats = $state<CharStats | null>(null);
  charMaxStats = $state<CharMaxStats | null>(null);
  charStatus = $state<CharStatus | null>(null);
  charWorth = $state<CharWorth | null>(null);
  roomInfo = $state<RoomInfo | null>(null);
  commChannel = $state<CommChannel | null>(null);
  group = $state<GroupMember[]>([]);

  updateModule(module: string, data: unknown): void {
    switch (module) {
      case 'Char.Base':
        this.charBase = data as CharBase;
        break;
      case 'Char.Vitals':
        this.charVitals = data as CharVitals;
        break;
      case 'Char.Stats':
        this.charStats = data as CharStats;
        break;
      case 'Char.MaxStats':
        this.charMaxStats = data as CharMaxStats;
        break;
      case 'Char.Status':
        this.charStatus = data as CharStatus;
        break;
      case 'Char.Worth':
        this.charWorth = data as CharWorth;
        break;
      case 'Room.Info':
        this.roomInfo = data as RoomInfo;
        break;
      case 'Comm.Channel':
        this.commChannel = data as CommChannel;
        break;
      case 'Group':
        this.group = data as GroupMember[];
        break;
    }
  }

  reset(): void {
    this.charBase = null;
    this.charVitals = null;
    this.charStats = null;
    this.charMaxStats = null;
    this.charStatus = null;
    this.charWorth = null;
    this.roomInfo = null;
    this.commChannel = null;
    this.group = [];
  }
}

export const gmcpState = new GmcpState();
