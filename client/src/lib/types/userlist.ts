/** A single user in the user list */
export interface UserlistEntry {
  objectNumber: string;     // e.g. "#200"
  name: string;
  icon: number;
  idle: boolean;
  away: boolean;
  invisible: boolean;
  /** Additional fields beyond the base 3 */
  extra: Map<string, unknown>;
}

/** Field definition from the userlist fields message */
export interface UserlistField {
  name: string;
  index: number;
}

/** Menu item for the userlist context menu */
export type UserlistMenuItem =
  | { type: 'separator' }
  | { type: 'action'; label: string; command: string };
