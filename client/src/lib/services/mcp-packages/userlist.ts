/**
 * MCP userlist package handler (dns-com-vmoo-userlist).
 *
 * This is the most complex MCP package. It manages the online user list
 * through a persistent multiline MCP message. The server keeps the
 * multiline message open and sends d-line updates as continuation lines.
 *
 * D-line format: <command-char><moo-list>
 *
 * Command characters:
 *   =  Initialize userlist (list of userinfo lists)
 *   +  Add user (single userinfo list)
 *   -  Remove users (list of object numbers)
 *   *  Update user info (single userinfo list)
 *   <  Set users idle
 *   >  Set users not idle
 *   [  Set users away
 *   ]  Set users not away
 *   (  Set users invisible
 *   )  Set users not invisible
 *
 * Userinfo format: {objectNumber, name, iconIndex, ...extraFields}
 */

import { mcpService } from '../mcp-service';
import { userlistState } from '../../state/userlist.svelte';
import { parseMooList, type MooValue } from '../../utils/moo-value-parser';
import type { UserlistEntry } from '../../types/userlist';

export function registerUserlistPackage(): void {
  // Main userlist message with multiline fields/icons/d
  mcpService.registerHandler('dns-com-vmoo-userlist', (msg) => {
    // Process fields definition
    const fieldsStr = msg.keyValues.get('fields');
    if (fieldsStr) {
      const fieldValues = parseMooList(fieldsStr);
      userlistState.fields = fieldValues.map((v, i) => ({
        name: String(v),
        index: i,
      }));
    }

    // Process icon name mappings
    const iconsStr = msg.keyValues.get('icons');
    if (iconsStr) {
      userlistState.icons = parseMooList(iconsStr).map((v) => String(v));
    }

    // Process d-lines (data updates)
    const dStr = msg.keyValues.get('d');
    if (dStr) {
      processDLine(dStr);
    }
  });

  // "You" message: tells us which object number is the connected player
  mcpService.registerHandler('dns-com-vmoo-userlist-you', (msg) => {
    userlistState.you = msg.keyValues.get('nr') ?? null;
  });

  // Friends list
  mcpService.registerHandler('dns-com-vmoo-userlist-friends', (msg) => {
    const friendsStr = msg.keyValues.get('friends');
    if (friendsStr) {
      userlistState.friends = parseMooList(friendsStr).map((v) => String(v));
    }
  });

  // Gag list (ignored users)
  mcpService.registerHandler('dns-com-vmoo-userlist-gaglist', (msg) => {
    const gagStr = msg.keyValues.get('gaglist');
    if (gagStr) {
      userlistState.gagList = parseMooList(gagStr).map((v) => String(v));
    }
  });

  // Context menu definition
  mcpService.registerHandler('dns-com-vmoo-userlist-menu', (msg) => {
    const menuStr = msg.keyValues.get('menu');
    if (menuStr) {
      const items = parseMooList(menuStr);
      userlistState.menu = items.map((item) => {
        // A separator is represented by the integer 0
        if (item === 0) {
          return { type: 'separator' as const };
        }
        // An action is a two-element list: {label, command}
        if (Array.isArray(item) && item.length >= 2) {
          return {
            type: 'action' as const,
            label: String(item[0]),
            command: String(item[1]),
          };
        }
        // Fallback: treat unknown items as separators
        return { type: 'separator' as const };
      });
    }
  });
}

/**
 * Process a single d-line from the userlist multiline message.
 *
 * The first character is the command, followed by a MOO list.
 */
function processDLine(line: string): void {
  if (line.length < 1) return;

  const cmd = line[0];
  const data = line.slice(1);

  switch (cmd) {
    case '=': {
      // Initialize: the list contains sub-lists, each being a userinfo
      const users = parseMooList(data);
      const entries: UserlistEntry[] = [];
      for (const user of users) {
        if (Array.isArray(user)) {
          const entry = parseUserInfo(user);
          if (entry) entries.push(entry);
        }
      }
      userlistState.setUsers(entries);
      break;
    }

    case '+': {
      // Add user: the list IS the userinfo (not wrapped in another list)
      const values = parseMooList(data);
      const entry = parseUserInfo(values);
      if (entry) userlistState.addUser(entry);
      break;
    }

    case '-': {
      // Remove users: list of object numbers
      const objNums = parseMooList(data).map((v) => String(v));
      userlistState.removeUsers(objNums);
      break;
    }

    case '*': {
      // Update user info: the list IS the userinfo
      const values = parseMooList(data);
      const entry = parseUserInfo(values);
      if (entry) userlistState.updateUser(entry);
      break;
    }

    case '<': {
      // Set users idle
      const objNums = parseMooList(data).map((v) => String(v));
      userlistState.setIdle(objNums, true);
      break;
    }

    case '>': {
      // Set users not idle
      const objNums = parseMooList(data).map((v) => String(v));
      userlistState.setIdle(objNums, false);
      break;
    }

    case '[': {
      // Set users away
      const objNums = parseMooList(data).map((v) => String(v));
      userlistState.setAway(objNums, true);
      break;
    }

    case ']': {
      // Set users not away
      const objNums = parseMooList(data).map((v) => String(v));
      userlistState.setAway(objNums, false);
      break;
    }

    case '(': {
      // Set users invisible (cloaked)
      const objNums = parseMooList(data).map((v) => String(v));
      userlistState.setInvisible(objNums, true);
      break;
    }

    case ')': {
      // Set users not invisible
      const objNums = parseMooList(data).map((v) => String(v));
      userlistState.setInvisible(objNums, false);
      break;
    }

    default:
      // Unknown command character - silently ignore per spec
      break;
  }
}

/**
 * Parse a MOO userinfo list into a UserlistEntry.
 *
 * Userinfo format: {objectNumber, name, iconIndex, ...extraFields}
 * The first three fields are always: Object (#num), Name (string), Icon (int).
 */
function parseUserInfo(values: MooValue[]): UserlistEntry | null {
  if (values.length < 3) return null;

  const entry: UserlistEntry = {
    objectNumber: String(values[0]),
    name: String(values[1]),
    icon: typeof values[2] === 'number' ? values[2] : 0,
    idle: false,
    away: false,
    invisible: false,
    extra: new Map(),
  };

  // Store additional fields beyond the base 3, keyed by field name
  for (let i = 3; i < values.length; i++) {
    const field = userlistState.fields[i];
    if (field) {
      entry.extra.set(field.name, values[i]);
    }
  }

  return entry;
}
