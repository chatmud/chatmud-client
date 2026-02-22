# ChatMUD Client

Web-based MUD client that connects to [ChatMUD](https://chatmud.com) (or any MUD) through a WebSocket-to-Telnet proxy. Svelte 5 + TypeScript frontend, Express + ws backend.

## What it does

- Proxies browser WebSocket connections to an upstream Telnet server
- Handles telnet negotiation (ECHO, SGA, NAWS, terminal type)
- Renders ANSI colors (256 and true color)
- Supports MCP (editing, user lists, status, etc.)
- Supports GMCP for room info, channel messages, and media playback
- Persists sessions across disconnects with configurable buffer replay
- Embeds Monaco for in-game editing
- Text-to-speech, screen reader support, skip links, keyboard nav
- Installable as a PWA
- Dockerized

## Setup

Node.js 22+. Run the proxy and client in separate terminals:

```sh
# proxy (port 3001)
cd proxy && npm install && npm run dev

# client (port 5173)
cd client && npm install && npm run dev
```

Vite proxies WebSocket connections to the backend in dev.

### Tests

```sh
cd client && npm test
```

## Deployment

### Docker

```sh
docker build -t chatmud-client .
docker run -p 3001:3001 chatmud-client
```

Or `docker-compose up`.

### Manual

```sh
cd client && npm ci && npm run build
cd ../proxy && npm ci && npm run build && npm start
```

Static files end up in `client/dist/`.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `UPSTREAM_URL` | `tls://chatmud.com:7443` | Target MUD server |
| `PERSISTENCE_TIMEOUT_MS` | `600000` | Session keepalive after disconnect (ms) |
| `MAX_BUFFER_LINES` | `1000` | Lines buffered for reconnect replay |
| `USE_PROXY_PROTOCOL` | `false` | HAProxy PROXY protocol v1 |

## GMCP

The client negotiates these [GMCP](https://www.gammon.com.au/gmcp) packages:

| Package | Used for |
|---|---|
| `Room.Info` | Room name, area, and exits shown in the sidebar |
| `Comm.Channel` | Channel message history with buffer switching |
| `Client.Media` | Sound/music playback via Web Audio (volume, fading, looping, priority) |

## Project layout

```
client/          Svelte frontend
  src/
    components/  UI (output, input, editor, settings, etc.)
    lib/
      audio/     Web Audio engine
      services/  WebSocket, telnet/ANSI/MCP/GMCP, TTS, media
      state/     Reactive state (Svelte 5 runes)
      types/     TypeScript interfaces
proxy/           WebSocket-to-Telnet proxy
  src/
    proxy.ts     Proxy logic
    index.ts     Express entry point
```
