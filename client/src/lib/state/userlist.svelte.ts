import type { UserlistEntry, UserlistField, UserlistMenuItem } from '../types/userlist';

class UserlistState {
  users = $state<UserlistEntry[]>([]);
  fields = $state<UserlistField[]>([]);
  icons = $state<string[]>([]);
  friends = $state<string[]>([]);
  gagList = $state<string[]>([]);
  menu = $state<UserlistMenuItem[]>([]);
  you = $state<string | null>(null);

  readonly sortedUsers = $derived(
    [...this.users].sort((a, b) => a.name.localeCompare(b.name))
  );

  readonly onlineCount = $derived(this.users.length);

  setUsers(entries: UserlistEntry[]): void {
    this.users = entries;
  }

  addUser(entry: UserlistEntry): void {
    this.users = [...this.users, entry];
  }

  removeUsers(objectNumbers: string[]): void {
    const set = new Set(objectNumbers);
    this.users = this.users.filter((u) => !set.has(u.objectNumber));
  }

  updateUser(entry: UserlistEntry): void {
    this.users = this.users.map((u) =>
      u.objectNumber === entry.objectNumber ? { ...u, ...entry } : u
    );
  }

  setIdle(objectNumbers: string[], idle: boolean): void {
    const set = new Set(objectNumbers);
    this.users = this.users.map((u) => (set.has(u.objectNumber) ? { ...u, idle } : u));
  }

  setAway(objectNumbers: string[], away: boolean): void {
    const set = new Set(objectNumbers);
    this.users = this.users.map((u) => (set.has(u.objectNumber) ? { ...u, away } : u));
  }

  setInvisible(objectNumbers: string[], invisible: boolean): void {
    const set = new Set(objectNumbers);
    this.users = this.users.map((u) => (set.has(u.objectNumber) ? { ...u, invisible } : u));
  }

  reset(): void {
    this.users = [];
    this.fields = [];
    this.icons = [];
    this.friends = [];
    this.gagList = [];
    this.menu = [];
    this.you = null;
  }
}

export const userlistState = new UserlistState();
