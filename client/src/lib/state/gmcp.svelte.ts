import type {
  RoomInfo,
  RoomPlayer,
  CommChannel,
  ChannelInfo,
  CharName,
  CharItem,
  CharItemsList,
  CharItemUpdate,
  CharLoginDefault,
  CharLoginResult,
} from '../types/gmcp';

class GmcpState {
  // Room
  roomInfo = $state<RoomInfo | null>(null);
  roomPlayers = $state<RoomPlayer[]>([]);

  // Comm.Channel
  commChannel = $state<CommChannel | null>(null);
  channelList = $state<ChannelInfo[]>([]);

  // Char
  charName = $state<CharName | null>(null);

  // Char.Items (keyed by location: "inv", "room", "repNNN")
  items = $state<Map<string, CharItem[]>>(new Map());

  // Char.Login
  loginDefault = $state<CharLoginDefault | null>(null);
  loginResult = $state<CharLoginResult | null>(null);

  updateModule(module: string, data: unknown): void {
    switch (module) {
      case 'Room.Info':
        this.roomInfo = data as RoomInfo;
        break;
      case 'Room.Players':
        this.roomPlayers = data as RoomPlayer[];
        break;
      case 'Room.AddPlayer':
        this.roomPlayers = [...this.roomPlayers, data as RoomPlayer];
        break;
      case 'Room.RemovePlayer': {
        const name = data as string;
        this.roomPlayers = this.roomPlayers.filter((p) => p.name !== name);
        break;
      }

      case 'Comm.Channel':
        this.commChannel = data as CommChannel;
        break;
      case 'Comm.Channel.List':
        this.channelList = data as ChannelInfo[];
        break;

      case 'Char.Name':
        this.charName = data as CharName;
        break;

      case 'Char.Items.List': {
        const list = data as CharItemsList;
        const next = new Map(this.items);
        next.set(list.location, list.items);
        this.items = next;
        break;
      }
      case 'Char.Items.Add': {
        const upd = data as CharItemUpdate;
        const next = new Map(this.items);
        const existing = next.get(upd.location) ?? [];
        next.set(upd.location, [...existing, upd.item]);
        this.items = next;
        break;
      }
      case 'Char.Items.Remove': {
        const upd = data as CharItemUpdate;
        const next = new Map(this.items);
        const existing = next.get(upd.location) ?? [];
        next.set(
          upd.location,
          existing.filter((i) => i.id !== upd.item.id),
        );
        this.items = next;
        break;
      }
      case 'Char.Items.Update': {
        const upd = data as CharItemUpdate;
        const next = new Map(this.items);
        const existing = next.get(upd.location) ?? [];
        next.set(
          upd.location,
          existing.map((i) => (i.id === upd.item.id ? upd.item : i)),
        );
        this.items = next;
        break;
      }

      case 'Char.Login.Default':
        this.loginDefault = data as CharLoginDefault;
        break;
      case 'Char.Login.Result':
        this.loginResult = data as CharLoginResult;
        break;
    }
  }

  reset(): void {
    this.roomInfo = null;
    this.roomPlayers = [];
    this.commChannel = null;
    this.channelList = [];
    this.charName = null;
    this.items = new Map();
    this.loginDefault = null;
    this.loginResult = null;
  }
}

export const gmcpState = new GmcpState();
