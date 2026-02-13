import {
  TelnetCommand,
  TelnetOption,
  TelnetParser,
  WebSocketStream,
} from "./telnet";

import { EventEmitter } from "eventemitter3";
import stripAnsi from "strip-ansi";
import { EditorManager } from "./EditorManager";
import {
  GMCPAutoLogin,
  GMCPChar,
  GMCPClientMedia,
  GMCPCore,
  GMCPCoreSupports,
  GMCPClientFileTransfer,
} from "./gmcp";
import type { GMCPPackage } from "./gmcp/package";
import {
  MCPKeyvals,
  MCPPackage,
  McpAwnsGetSet,
  McpNegotiate,
  generateTag,
  parseMcpMessage,
  parseMcpMultiline,
} from "./mcp";

import { Cacophony } from "cacophony";
import { AutoreadMode, preferencesStore } from "./PreferencesStore";
import { WebRTCService } from "./WebRTCService";
import FileTransferManager from "./FileTransferManager.js";
import { GMCPMessageRoomInfo, RoomPlayer } from "./gmcp/Room"; // Import RoomPlayer
import { midiService } from "./MidiService";
import packageJson from "../package.json";

// Build version string with commit hash if available
const VERSION = packageJson.version;
const COMMIT_HASH = import.meta.env.VITE_COMMIT_HASH || "dev";
const CLIENT_VERSION = `ChatMUD Client ${VERSION} (${COMMIT_HASH.slice(0, 7)})`;

export interface WorldData {
  liveKitTokens: string[];
  playerId: string;
  playerName: string;
  roomId: string;
  roomPlayers: RoomPlayer[]; // Changed from string[]
}

class MudClient extends EventEmitter {
  private ws!: WebSocket;
  private decoder = new TextDecoder("utf8");
  private telnet!: TelnetParser;
  private _connected: boolean = false;
  private intentionalDisconnect: boolean = false;
  private reconnectAttempts: number = 0;
  private hasEmittedDisconnect: boolean = false;
  private sessionId: string | null = null;
  private readonly SESSION_STORAGE_KEY = "mudclient_session_id";
  private replayingBufferedMessages: boolean = false;
  private bufferedMessageCount: number = 0;

  get connected(): boolean {
    return this._connected;
  }

  private host: string;
  private port: number;
  private wsUrl?: string;
  private telnetNegotiation: boolean = false;
  private telnetBuffer: string = "";
  public gmcpHandlers: { [key: string]: GMCPPackage } = {};
  public mcpHandlers: { [key: string]: MCPPackage } = {};
  public mcpMultilines: { [key: string]: MCPPackage } = {};
  private mcpAuthKey: string | null = null;
  mcp_negotiate: McpNegotiate;
  public mcp_getset: McpAwnsGetSet;
  public gmcp_char: GMCPChar;
  public gmcp_fileTransfer: GMCPClientFileTransfer;
  public worldData: WorldData = {
    playerId: "",
    playerName: "",
    roomId: "",
    liveKitTokens: [],
    roomPlayers: [], // Initialized as RoomPlayer[]
  };
  public cacophony: Cacophony;
  public editors: EditorManager;
  public webRTCService: WebRTCService;
  public fileTransferManager: FileTransferManager;
  public currentRoomInfo: GMCPMessageRoomInfo | null = null; // Add property to store room info
  private _autosay: boolean = false;
  private globalMuted: boolean = false;
  private isWindowFocused: boolean = true;

  get autosay(): boolean {
    return this._autosay;
  }

  set autosay(value: boolean) {
    this._autosay = value;
    this.emit('autosayChanged', value);
  }

  constructor(host: string, port: number, wsUrl?: string) {
    super();
    this.host = host;
    this.port = port;
    this.wsUrl = wsUrl;
    this.mcp_negotiate = this.registerMcpPackage(McpNegotiate);
    this.mcp_getset = this.registerMcpPackage(McpAwnsGetSet);
    this.gmcp_char = this.registerGMCPPackage(GMCPChar);
    this.gmcp_fileTransfer = this.registerGMCPPackage(GMCPClientFileTransfer);
    this.cacophony = new Cacophony();
    this.cacophony.setGlobalVolume(preferencesStore.getState().sound.volume);
    this.editors = new EditorManager(this);
    this.webRTCService = new WebRTCService(this);
    this.fileTransferManager = new FileTransferManager(
      this,
      this.gmcp_fileTransfer
    );
    
    // Set up window focus event listeners
    window.addEventListener('focus', () => {
      this.isWindowFocused = true;
      this.updateBackgroundMuteState();
    });
    
    window.addEventListener('blur', () => {
      this.isWindowFocused = false;
      this.updateBackgroundMuteState();
    });
    
    // Subscribe to preference changes
    preferencesStore.subscribe(() => {
      this.updateBackgroundMuteState();
    });
  }
  // File Transfer related methods
  async sendFile(file: File, recipient: string): Promise<void> {
    await this.fileTransferManager.sendFile(file, recipient);
  }

  cancelTransfer(hash: string): void {
    this.fileTransferManager.cancelTransfer(hash);
  }

  acceptTransfer(sender: string, hash: string): void {
    this.fileTransferManager.acceptTransfer(sender, hash).catch(error => {
      console.error("[MudClient] Failed to accept transfer:", error);
      this.onFileTransferError(hash, "unknown", "receive", error.message);
    });
  }

  rejectTransfer(sender: string, hash: string): void {
    this.gmcp_fileTransfer.sendReject(sender, hash);
  }

  // File Transfer event handlers
  onFileTransferOffer(
    sender: string,
    hash: string,
    filename: string,
    filesize: number,
    offerSdp: string
  ): void {
    console.log("[MudClient] Emitting fileTransferOffer event:", {
      sender,
      hash,
      filename,
      filesize,
      offerSdp,
    });
    this.emit("fileTransferOffer", {
      sender,
      hash,
      filename,
      filesize,
      offerSdp,
    });
  }

  onFileTransferAccept(
    sender: string,
    hash: string,
    filename: string,
    answerSdp: string
  ): void {
    console.log("[MudClient] Emitting fileTransferAccepted event:", {
      sender,
      hash,
      filename,
      answerSdp,
    });
    this.emit("fileTransferAccepted", { sender, hash, filename, answerSdp });
  }

  onFileTransferReject(sender: string, hash: string): void {
    this.emit("fileTransferRejected", { sender, hash });
  }

  onFileTransferCancel(sender: string, hash: string): void {
    this.emit("fileTransferCancelled", { sender, hash });
  }

  onFileSendComplete(hash: string, filename: string): void {
    this.emit("fileSendComplete", { hash, filename });
  }

  onFileTransferError(
    hash: string,
    filename: string,
    direction: "send" | "receive",
    error: string
  ): void {
    this.emit("fileTransferError", { hash, filename, direction, error });
  }

  onConnectionRecovered(data: {
    filename: string;
    direction: "send" | "receive";
    hash: string;
  }): void {
    this.emit("connectionRecovered", data);
  }

  onRecoveryFailed(data: {
    filename: string;
    direction: "send" | "receive";
    error: string;
  }): void {
    this.emit("recoveryFailed", data);
  }

  // GMCP methods for file transfer
  sendFileTransferOffer(
    recipient: string,
    filename: string,
    hash: string,
    filesize: number,
    offerSdp: string
  ): void {
    this.gmcp_fileTransfer.sendOffer(
      recipient,
      filename,
      filesize,
      offerSdp,
      hash
    );
  }

  sendFileTransferAccept(
    sender: string,
    filename: string,
    hash: string,
    answerSdp: string
  ): void {
    this.gmcp_fileTransfer.sendAccept(sender, hash, filename, answerSdp);
  }

  registerGMCPPackage<P extends GMCPPackage>(p: new (_: MudClient) => P): P {
    const gmcpPackage = new p(this);
    this.gmcpHandlers[gmcpPackage.packageName] = gmcpPackage;
    console.log("Registered GMCP Package:", gmcpPackage.packageName);
    return gmcpPackage;
  }

  registerMcpPackage<P extends MCPPackage>(p: new (_: MudClient) => P): P {
    const mcpPackage = new p(this);
    this.mcpHandlers[mcpPackage.packageName] = mcpPackage;
    return mcpPackage;
  }

  /**
   * Load session ID from localStorage
   */
  private loadSessionId(): string | null {
    try {
      return localStorage.getItem(this.SESSION_STORAGE_KEY);
    } catch (e) {
      console.warn("[Session] Failed to load session ID from localStorage:", e);
      return null;
    }
  }

  /**
   * Save session ID to localStorage
   */
  private saveSessionId(sessionId: string): void {
    try {
      localStorage.setItem(this.SESSION_STORAGE_KEY, sessionId);
      this.sessionId = sessionId;
      console.log("[Session] Saved session ID:", sessionId);
    } catch (e) {
      console.warn("[Session] Failed to save session ID to localStorage:", e);
    }
  }

  /**
   * Clear session ID from localStorage
   */
  private clearSessionId(): void {
    try {
      localStorage.removeItem(this.SESSION_STORAGE_KEY);
      this.sessionId = null;
      console.log("[Session] Cleared session ID");
    } catch (e) {
      console.warn("[Session] Failed to clear session ID from localStorage:", e);
    }
  }

  /**
   * Handle proxy control messages (session management)
   */
  private handleProxyMessage(data: ArrayBuffer): boolean {
    // Proxy messages start with 0x00 byte
    const view = new Uint8Array(data);
    if (view.length === 0 || view[0] !== 0x00) {
      return false; // Not a proxy message
    }

    try {
      const payload = this.decoder.decode(data.slice(1));
      const message = JSON.parse(payload);

      switch (message.type) {
        case "session":
          console.log("[Session] Received new session ID:", message.sessionId);
          this.saveSessionId(message.sessionId);
          this.emit("sessionCreated", message.sessionId, message.config);
          break;

        case "reconnected":
          console.log("[Session] Reconnected to existing session:", message.sessionId, `(${message.bufferedCount} buffered messages)`);
          this.bufferedMessageCount = message.bufferedCount;
          if (message.bufferedCount > 0) {
            this.replayingBufferedMessages = true;
            this.emit("bufferReplayStart", message.bufferedCount);
          }
          this.emit("sessionReconnected", message.sessionId, message.bufferedCount);
          break;

        case "error":
          console.error("[Session] Proxy error:", message.error);
          // If session not found, clear it and reconnect fresh
          if (message.error === "Session not found") {
            this.clearSessionId();
          }
          this.emit("sessionError", message.error);
          break;

        case "configUpdated":
          console.log("[Session] Configuration updated:", message.config);
          this.emit("sessionConfigUpdated", message.config);
          break;

        case "bufferReplayComplete":
          console.log("[Session] Buffer replay complete:", message.count, "messages replayed");
          this.replayingBufferedMessages = false;
          this.bufferedMessageCount = 0;
          this.emit("bufferReplayComplete", message.count);
          break;

        default:
          console.warn("[Session] Unknown proxy message type:", message.type);
      }

      return true; // Proxy message handled
    } catch (e) {
      console.error("[Session] Failed to parse proxy message:", e);
      return false;
    }
  }

  public connect() {
    this.intentionalDisconnect = false;

    // Load existing session ID if available
    const existingSessionId = this.loadSessionId();

    // Build WebSocket URL with optional sessionId parameter
    let url = this.wsUrl || `wss://${this.host}:${this.port}`;
    if (existingSessionId) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}sessionId=${existingSessionId}`;
      console.log("[Session] Reconnecting with session ID:", existingSessionId);
    } else {
      console.log("[Session] Connecting without session ID (new session)");
    }

    this.ws = new window.WebSocket(url);
    this.ws.binaryType = "arraybuffer";
    this.telnet = new TelnetParser(new WebSocketStream(this.ws));
    this.ws.onopen = () => {
      this._connected = true;
      this.reconnectAttempts = 0;
      this.hasEmittedDisconnect = false;

      // Reset MIDI intentional disconnect flags when successfully reconnecting to server
      midiService.resetIntentionalDisconnectFlags();

      // Resume looping ambient sounds after reconnect
      const media = this.gmcpHandlers["Client.Media"] as GMCPClientMedia;
      media.resumeLoopingSounds();

      this.emit("connect");
      this.emit("connectionChange", true);
    };

    this.telnet.on("data", (data: ArrayBuffer) => {
      this.handleData(data);
    });

    // Wrap the WebSocket's onmessage to intercept proxy messages
    // This must be done AFTER telnet.on("data") so we wrap its handler
    const originalOnMessage = this.ws.onmessage;
    this.ws.onmessage = (event: MessageEvent) => {
      // Check if this is a proxy control message
      if (this.handleProxyMessage(event.data)) {
        return; // Proxy message handled, don't pass to telnet parser
      }
      // Not a proxy message, pass to original handler (telnet parser)
      if (originalOnMessage) {
        originalOnMessage.call(this.ws, event);
      }
    };

    this.telnet.on("negotiation", (command, option) => {
      // Negotiation that we support GMCP
      if (command === TelnetCommand.WILL && option === TelnetOption.GMCP) {
        console.log("GMCP Negotiation");
        this.telnet.sendNegotiation(TelnetCommand.DO, TelnetOption.GMCP);
        (this.gmcpHandlers["Core"] as GMCPCore).sendHello();
        (this.gmcpHandlers["Core.Supports"] as GMCPCoreSupports).sendSet();
        (this.gmcpHandlers["Auth"] as GMCPAutoLogin).sendLogin();
      } else if (
        command === TelnetCommand.DO &&
        option === TelnetOption.TERMINAL_TYPE
      ) {
        console.log("TTYPE Negotiation");
        this.telnet.sendNegotiation(
          TelnetCommand.WILL,
          TelnetOption.TERMINAL_TYPE
        );
        this.telnet.sendTerminalType(CLIENT_VERSION);
        this.telnet.sendTerminalType("ANSI");
        this.telnet.sendTerminalType("PROXY");
      }
    });

    this.telnet.on("gmcp", (packageName, data) => {
      console.log("GMCP Package:", packageName, data);
      try {
        this.handleGmcpData(packageName, data);
      } catch (e) {
        console.error("Calling GMCP:", e);
      }
    });

    this.ws.onclose = () => {
      const wasConnected = this._connected;
      this.cleanupConnection(wasConnected);
      // Only auto reconnect if it wasn't an intentional disconnect
      if (!this.intentionalDisconnect) {
        // Exponential backoff: 5s, 10s, 20s, 40s, capped at 60s
        const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts), 60000);
        this.reconnectAttempts++;
        setTimeout(() => {
          this.connect();
        }, delay);
      }
    };

    this.ws.onerror = (error: Event) => {
      this.emit("error", error);
    };
  }

  public send(data: string) {
    this.ws.send(data);
  }

  private cleanupConnection(wasConnected: boolean = true): void {
    this._connected = false;
    this.telnetBuffer = "";
    this.telnetNegotiation = false;
    this.currentRoomInfo = null; // Reset room info on cleanup
    this.webRTCService.cleanup();
    this.fileTransferManager.cleanup();

    // Only emit disconnect once — not on every failed reconnect attempt
    if (!this.hasEmittedDisconnect) {
      this.hasEmittedDisconnect = true;
      this.emit("disconnect");
      this.emit("connectionChange", false);
    }
  }

  public close(): void {
    this.intentionalDisconnect = true;
    this.reconnectAttempts = 0;
    this.hasEmittedDisconnect = false;
    // Clear session and MCP auth key on intentional disconnect
    this.clearSessionId();
    this.mcpAuthKey = null;
    if (this.ws) {
      this.ws.close(1000, "User disconnect");
    }
    this.cleanupConnection();
  }

  public sendCommand(command: string): void {
    const localEchoEnabled = preferencesStore.getState().general.localEcho;
    if (localEchoEnabled) {
      this.emit("command", command);
    }
    if (this.autosay && !command.startsWith("-") && !command.startsWith("'")) {
      command = "say " + command;
    }
    this.send(command + "\r\n");
    console.log("> " + command);
  }

  /*
<message> ::= <message-start>
           | <message-continue>
           | <message-end>
<message-start> ::= <message-name> <space> <auth-key> <keyvals>
An MCP message consists of three parts: the name of the message, the authentication key, and a set of keywords and their associated values. The message name indicates what action is to be performed; if the given message name is unknown, the message should be ignored. The authentication key is generated at the beginning of the session; if it is incorrect, the message should be ignored. The keyword-value pairs specify the arguments to the message. These arguments may occur in any order, and the ordering of the arguments does not affect the semantics of the message. There is no limit on the number of keyword-value pairs which may appear in a message, or on the lengths of message names, keywords, or values.
*/

  private handleData(data: ArrayBuffer) {
    const decoded = this.decoder.decode(data).trimEnd();
    for (const line of decoded.split("\n")) {
      if (line && line.startsWith("#$#")) {
        // MCP
        this.handleMcp(line);
      } else {
        this.emitMessage(line);
      }
    }
  }

  private handleMcp(decoded: string) {
    if (decoded.startsWith("#$#*")) {
      // multiline
      const continuation = parseMcpMultiline(decoded.trimEnd());
      if (continuation)
        if (continuation.name in this.mcpMultilines)
          this.mcpMultilines[continuation.name].handleMultiline(continuation);
        else
          console.warn(
            "Received continuation for unknown multiline",
            continuation
          );
      return;
    }
    if (decoded.startsWith("#$#:")) {
      const closure = parseMcpMultiline(decoded.trimEnd());
      if (closure) {
        this.mcpMultilines[closure.name].closeMultiline(closure);
        delete this.mcpMultilines[closure.name];
      }
      return;
    }
    const mcpMessage = parseMcpMessage(decoded.trimEnd());
    console.log("MCP Message:", mcpMessage);
    if (
      mcpMessage?.name.toLowerCase() === "mcp" &&
      mcpMessage.authKey == null &&
      this.mcpAuthKey == null
    ) {
      // Authenticate
      this.mcpAuthKey = generateTag();
      this.sendCommand(
        `#$#mcp authentication-key: ${this.mcpAuthKey} version: 2.1 to: 2.1`
      );
      this.mcp_negotiate.sendNegotiate();
    } else if (mcpMessage?.name === "mcp-negotiate-end") {
      // spec says to refuse additional negotiations after this, but it's not really needed
    } else if (mcpMessage?.authKey === this.mcpAuthKey) {
      let name = mcpMessage.name;
      do {
        if (name in this.mcpHandlers) {
          this.mcpHandlers[name].handle(mcpMessage);
          if ("_data-tag" in mcpMessage.keyvals) {
            console.log("new multiline " + mcpMessage.keyvals["_data-tag"]);
            this.mcpMultilines[mcpMessage.keyvals["_data-tag"]] =
              this.mcpHandlers[name];
          }
          return;
        }
        name = name.substring(0, name.lastIndexOf("-"));
      } while (name);
      console.log(`No handler for ${mcpMessage.name}`);
    } else {
      console.log(
        `Unexpected authkey "${mcpMessage?.authKey}", probably a spoofed message.`
      );
    }
  }

  private handleGmcpData(gmcpPackage: string, gmcpMessage: string) {
    //split to packageName and message type. the message name is after the last period of the gmcp package. the package can hav emultiple dots.
    const lastDot = gmcpPackage.lastIndexOf(".");
    const packageName = gmcpPackage.substring(0, lastDot);
    const messageType = gmcpPackage.substring(lastDot + 1);

    console.log("GMCP Message:", packageName, messageType, gmcpMessage);
    const handler = this.gmcpHandlers[packageName];
    if (!handler) {
      console.log("No handler for GMCP package:", packageName);
      return;
    }
    // Look for the handler using the exact messageType from the package string
    const messageHandler = (handler as any)["handle" + messageType];

    if (messageHandler) {
      console.log("Calling handler for:", messageType, messageHandler); // Log original type

      let jsonStringToParse: string;
      // Check if gmcpMessage is a valid, non-empty string
      if (typeof gmcpMessage === 'string' && gmcpMessage.trim() !== '') {
        jsonStringToParse = gmcpMessage;
      } else {
        // Log a warning and default to an empty JSON object string
        console.warn(`GMCP message data for ${packageName}.${messageType} is missing or empty. Defaulting to {}. Original data:`, gmcpMessage);
        jsonStringToParse = '{}';
      }

      try {
        const parsedData = JSON.parse(jsonStringToParse);
        messageHandler.call(handler, parsedData);
      } catch (e) {
        // Add specific error handling for JSON parsing failure
        console.error(`Error parsing GMCP JSON for ${packageName}.${messageType}:`, e);
        console.error("Attempted to parse:", jsonStringToParse); // Log the string we tried to parse
        // Optionally, you could decide whether to still call the handler with null/undefined/default data
        // messageHandler.call(handler, {}); // Example: Call with empty object on parse failure
      }
    } else {
      // Use original messageType in the error message
      console.log("No handler on package:", packageName, messageType);
    }
  }

  private emitMessage(dataString: string) {
    const autoreadMode = preferencesStore.getState().speech.autoreadMode;
    if (autoreadMode === AutoreadMode.All) {
      this.speak(dataString);
    }
    if (autoreadMode === AutoreadMode.Unfocused && !document.hasFocus()) {
      this.speak(dataString);
    }
    this.emit("message", dataString, this.replayingBufferedMessages);
  }

  sendGmcp(packageName: string, data?: any) {
    console.log("Sending GMCP:", packageName, data);
    this.telnet.sendGmcp(packageName, data);
  }

  sendMcp(command: string, data?: any) {
    if (typeof data === "object") {
      let str = "";
      for (const [key, value] of Object.entries(data)) {
        str += ` ${key}: ${value || '""'}`;
      }
      data = str;
    }
    const toSend = `#$#${command} ${this.mcpAuthKey} ${data}\r\n`;
    this.send(toSend);
  }

  sendMcpMLLine(MLTag: string, key: string, val: string) {
    this.send(`#$#* ${MLTag} ${key}: ${val}\r\n`);
  }

  closeMcpML(MLTag: string) {
    this.send(`#$#: ${MLTag}\r\n`);
  }

  sendMCPMultiline(mcpMessage: string, keyvals: MCPKeyvals, lines: string[]) {
    const MLTag = generateTag();
    keyvals["_data-tag"] = MLTag;

    this.sendMcp(mcpMessage, keyvals);
    for (const line of lines) {
      this.sendMcpMLLine(MLTag, "content", line);
    }
    this.closeMcpML(MLTag);
  }

  shutdown() {
    Object.values(this.mcpHandlers).forEach((handler) => {
      handler.shutdown();
    });
    Object.values(this.gmcpHandlers).forEach((handler) => {
      handler.shutdown();
    });
    this.editors.shutdown();
    this.webRTCService.cleanup();
    this.fileTransferManager.cleanup();
  }

  requestNotificationPermission() {
    // handle notifications
    // may not be available in all browsers
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notification");
      return;
    }
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  sendNotification(title: string, body: string) {
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notification");
      return;
    }

    if (Notification.permission === "granted") {
      new Notification(title, { body });
    }
  }

  speak(text: string) {
    if (!("speechSynthesis" in window)) {
      console.log("This browser does not support speech synthesis");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(stripAnsi(text));
    utterance.lang = "en-US";
    const { rate, pitch, voice, volume } = preferencesStore.getState().speech;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    const voices = speechSynthesis.getVoices();
    const selectedVoice = voices.find((v) => v.name === voice);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    speechSynthesis.speak(utterance);
  }

  cancelSpeech() {
    speechSynthesis.cancel();
  }

  stopAllSounds() {
    const gmcpClientMedia = this.gmcpHandlers[
      "Client.Media"
    ] as GMCPClientMedia;
    gmcpClientMedia.stopAllSounds();
  }

  updateBackgroundMuteState() {
    const prefs = preferencesStore.getState();
    const shouldMuteInBackground = prefs.sound.muteInBackground && !this.isWindowFocused;
    
    // Apply mute state: global mute OR background mute
    this.cacophony.muted = this.globalMuted || shouldMuteInBackground;
  }

  setGlobalMute(muted: boolean) {
    this.globalMuted = muted;
    this.updateBackgroundMuteState();
    this.emit('muteChanged', muted);
  }
}

export default MudClient;
