# ChatMUD Client

Web-based MUD client that connects to [ChatMUD](https://chatmud.com) (or any MUD) through a WebSocket-to-Telnet proxy. Svelte 5 + TypeScript frontend, Express + ws backend.

## What it does

- Proxies browser WebSocket connections to an upstream Telnet server
- Handles telnet negotiation (ECHO, SGA, NAWS, terminal type)
- Renders ANSI colors (256 and true color)
- Supports MCP (editing, user lists, status, etc.)
- Supports GMCP for room info, channels, media, and rich HTML/Markdown rendering
- Persists sessions across disconnects with configurable buffer replay
- Embeds Monaco for in-game editing
- Text-to-speech, screen reader support, skip links, keyboard nav
- Installable as a PWA

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
cd proxy && npm test
```

## Deployment

### Docker Compose (recommended)

The full stack (nginx serving the client + WebSocket proxy) runs via compose:

```sh
docker compose up
```

This builds two images: `client` (nginx, serves static assets, proxies `/ws` to the backend) and `proxy` (Node, handles WebSocket-to-Telnet). The client is exposed on port 3001 by default.

### Proxy only

If you're serving the client separately (e.g. from a CDN), you can build and run just the proxy:

```sh
docker build -t chatmud-proxy .
docker run -p 3001:3001 chatmud-proxy
```

### Manual

```sh
cd client && npm ci && npm run build
cd ../proxy && npm ci && npm run build && npm start
```

Static files end up in `client/dist/`. Point your web server at them and proxy `/ws` to the backend.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Proxy server port |
| `UPSTREAM_URL` | `tls://chatmud.com:7443` | Target MUD server |
| `PERSISTENCE_TIMEOUT_MS` | `600000` | Session keepalive after disconnect (ms) |
| `MAX_BUFFER_LINES` | `1000` | Lines buffered for reconnect replay |
| `USE_PROXY_PROTOCOL` | `false` | HAProxy PROXY protocol v1 |

## GMCP

The client negotiates these [GMCP](https://www.gammon.com.au/gmcp) packages:

| Package | What we do with it |
|---|---|
| `Char` | Store character name; vitals/status/skills received but not displayed |
| `Char.Items` | Track inventory and room items (add/remove/update) |
| `Char.Login` | Receive login method advertisement and auth results |
| `Room` | Room name, area, exits in the sidebar; player enter/leave tracking |
| `Comm.Channel` | Channel message history with buffer switching; channel list |
| `Client.Media` | Sound/music playback via Web Audio (volume, fading, looping, priority) |
| `Client.Render` | Inline rich content (HTML or Markdown) rendered in the scrollback via `Client.Render.Add` ([spec](/docs/gmcp/client-render.md)) |

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
    index.ts     Express entry point
    proxy.ts     Proxy logic
    config.ts    Environment config
```

## License

[AGPL-3.0](license)
