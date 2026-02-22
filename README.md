# ChatMUD Client

A web-based MUD client for connecting to [ChatMUD](https://chatmud.com) (and other MUD servers) from a browser. It works by proxying WebSocket connections from the browser through a Node.js backend to the upstream Telnet server.

Built with Svelte 5 and TypeScript on the frontend, Express + ws on the backend.

## Features

- Full telnet negotiation (ECHO, SGA, NAWS, terminal type)
- ANSI color rendering (256-color and true color)
- MCP (MUD Client Protocol) support with packages for editing, user lists, status, and more
- GMCP (Generic MUD Communication Protocol) support (see below)
- Session persistence across disconnects with configurable buffer replay
- Integrated Monaco editor for in-game editing
- Text-to-speech
- Accessibility: screen reader support, skip links, keyboard navigation
- Installable as a PWA
- Docker deployment with a multi-stage build

## Development

You'll need Node.js 22+.

Run the proxy and client in separate terminals:

```sh
# proxy (port 3001)
cd proxy
npm install
npm run dev

# client (port 5173)
cd client
npm install
npm run dev
```

The Vite dev server proxies WebSocket connections to the backend automatically.

### Tests

```sh
cd client
npm test
```

## Production

### Docker

```sh
docker build -t chatmud-client .
docker run -p 3001:3001 chatmud-client
```

Or with docker-compose:

```sh
docker-compose up
```

### Manual

```sh
cd client && npm ci && npm run build
cd ../proxy && npm ci && npm run build && npm start
```

The client build outputs static files into `client/dist/`.

## Configuration

All configuration is through environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `UPSTREAM_URL` | `tls://chatmud.com:7443` | Target MUD server |
| `PERSISTENCE_TIMEOUT_MS` | `600000` | How long to keep a session alive after disconnect (ms) |
| `MAX_BUFFER_LINES` | `1000` | Lines to buffer for replay on reconnect |
| `USE_PROXY_PROTOCOL` | `false` | Enable HAProxy PROXY protocol v1 |

## GMCP Support

The client negotiates the following [GMCP](https://www.gammon.com.au/gmcp) packages with the server:

| Package | Description |
|---|---|
| `Char.Base` | Character identity (name, class, race, level) |
| `Char.Vitals` | HP, mana, and movement points (current and max) |
| `Char.Stats` | Character attribute scores |
| `Char.MaxStats` | Maximum character attribute scores |
| `Char.Status` | General character status flags |
| `Char.Worth` | Currency and wealth information |
| `Room.Info` | Current room name, area, description, and exits (displayed in the sidebar) |
| `Comm.Channel` | Channel messages with channel name, sender, and content |
| `Group` | Party/group member list |
| `Client.Media` | Sound and music playback with volume, fading, looping, priority, and captions |

`Room.Info` data is shown in the sidebar. `Client.Media` drives a full audio playback engine. The remaining packages store their data in reactive state for use by future UI components or user scripts.

## Project Structure

```
client/          Svelte frontend
  src/
    components/  UI components (output, input, editor, settings, etc.)
    lib/
      services/  WebSocket client, telnet/ANSI/MCP/GMCP parsers, TTS
      state/     Reactive state (Svelte 5 runes)
      types/     TypeScript interfaces
proxy/           Node.js WebSocket-to-Telnet proxy
  src/
    proxy.ts     Core proxy logic
    index.ts     Express server entry point
```
