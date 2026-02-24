/**
 * Application bootstrap: wires up the WebSocket service handlers to connect
 * the telnet parser, output processor, GMCP service, and connection state.
 *
 * Must be called once at application startup (e.g. from main.ts).
 */

import { wsService } from './websocket';
import { TelnetParser } from './telnet-parser';
import { TelnetNegotiator } from './telnet-negotiator';
import { OutputProcessor } from './output-processor';
import { gmcpService } from './gmcp-service';
import { mcpService } from './mcp-service';
import { connectionState } from '../state/connection.svelte';
import { outputState } from '../state/output.svelte';
import { registerNegotiatePackage } from './mcp-packages/negotiate';
import { registerPingPackage, startPingTimer, stopPingTimer } from './mcp-packages/ping';
import { registerStatusPackage } from './mcp-packages/status';
import { registerServerInfoPackage } from './mcp-packages/serverinfo';
import { registerDisplayUrlPackage } from './mcp-packages/displayurl';
import { registerSimpleeditPackage } from './mcp-packages/simpleedit';
import { registerUserlistPackage } from './mcp-packages/userlist';
import { registerClientPackage } from './mcp-packages/client';
import { ttsEngine } from './tts-engine';
import { mediaService } from './media-service';
import { ttsState } from '../state/tts.svelte';
import { channelHistoryState } from '../state/channel-history.svelte';

let replayLineCount = 0;
let resumingSession = false;
let wasConnected = false;
let suppressionTimer: ReturnType<typeof setTimeout> | null = null;

export function initServices(): void {
  ttsEngine.init();
  channelHistoryState.setupKeyboardHandler();
  const telnetParser = new TelnetParser();
  const outputProcessor = new OutputProcessor();
  const telnetNegotiator = new TelnetNegotiator(
    (data) => wsService.sendRaw(data),
    (module, data) => gmcpService.handleMessage(module, data),
  );

  // Wire MCP: give it a way to send data, and hook it into the output processor
  mcpService.setSendRaw((data) => wsService.sendRaw(data));
  outputProcessor.setMcpHandler((line) => mcpService.processLine(line));

  // Register all MCP packages
  registerNegotiatePackage();
  registerPingPackage();
  registerStatusPackage();
  registerServerInfoPackage();
  registerDisplayUrlPackage();
  registerSimpleeditPackage();
  registerUserlistPackage();
  registerClientPackage();

  wsService.setHandlers(
    // onData: raw bytes from the WebSocket
    (data: Uint8Array) => {
      const events = telnetParser.processData(data);
      let textChunk = '';

      /** Add lines and track count during buffer replay. */
      function addLines(lines: import('../types/output').OutputLine[]) {
        if (ttsState.suppressed) replayLineCount += lines.length;
        outputState.addLines(lines);
      }

      for (const event of events) {
        switch (event.type) {
          case 'text': {
            const decoded = new TextDecoder().decode(event.data);
            textChunk += decoded;
            break;
          }
          case 'negotiate':
            // Flush any accumulated text before handling negotiation
            if (textChunk) {
              addLines(outputProcessor.processText(textChunk));
              textChunk = '';
            }
            telnetNegotiator.handleNegotiation(event.command, event.option);
            break;
          case 'subnegotiate':
            if (textChunk) {
              addLines(outputProcessor.processText(textChunk));
              textChunk = '';
            }
            telnetNegotiator.handleSubnegotiation(event.option, event.data);
            break;
          case 'command':
            // GA (Go Ahead) means flush the prompt
            if (textChunk) {
              addLines(outputProcessor.processText(textChunk));
              textChunk = '';
            }
            {
              const prompt = outputProcessor.flushPrompt();
              if (prompt) {
                addLines([prompt]);
              }
            }
            break;
        }
      }

      // Flush any remaining text
      if (textChunk) {
        addLines(outputProcessor.processText(textChunk));
      }
    },

    // onProxy: proxy control messages
    (msg) => {
      connectionState.handleProxyMessage(msg);
      if (msg.type === 'bufferReplayComplete') {
        if (suppressionTimer !== null) {
          clearTimeout(suppressionTimer);
          suppressionTimer = null;
        }
        resumingSession = false;
        const count = replayLineCount;
        replayLineCount = 0;
        ttsState.suppressed = false;
        if (count > 0) {
          const summary = `${count} missed ${count === 1 ? 'line' : 'lines'} replayed.`;
          ttsEngine.speakLine(summary);
          outputState.announce(summary);
        }
      }
    },

    // onStatus: connection status changes
    (status) => {
      connectionState.status = status;
      if (status === 'connected') {
        outputState.addSystemLine('connected');
        if (resumingSession) {
          // Suppress TTS/announcements during buffer replay, but set a
          // safety timeout in case bufferReplayComplete never arrives
          // (e.g. nothing was buffered, or the session was fresh).
          ttsState.suppressed = true;
          replayLineCount = 0;
          if (suppressionTimer !== null) {
            clearTimeout(suppressionTimer);
          }
          suppressionTimer = setTimeout(() => {
            suppressionTimer = null;
            if (ttsState.suppressed) {
              resumingSession = false;
              ttsState.suppressed = false;
            }
          }, 2000);
        }
        startPingTimer();
        wasConnected = true;
      } else if (status === 'disconnected') {
        if (wasConnected) {
          outputState.addSystemLine('disconnected');
        }
        wasConnected = false;
        stopPingTimer();
      }
    },
  );

  // Restore persisted session ID and auto-reconnect if one exists
  connectionState.loadSessionId();
  if (connectionState.sessionId) {
    resumingSession = true;
    wsService.connect(connectionState.sessionId);
  }

  window.addEventListener('pagehide', () => {
    ttsEngine.destroy();
    mediaService.destroy();
  }, { once: true });
}
