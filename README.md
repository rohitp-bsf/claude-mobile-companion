# Claude Mobile Companion

Control Claude Code CLI from your phone. Real-time streaming, tool approvals, and session management via a mobile-friendly PWA.

## Problem

Claude Code plans and tasks take time. When you step away from your desk — bathroom break, making coffee, going to bed — you lose the ability to:
- Monitor what Claude is doing
- Approve or reject tool calls
- Send follow-up messages
- Know when a session completes

## Solution

A lightweight bridge server that wraps the Claude Code SDK, streams output over WebSocket, and serves a mobile PWA. Open it on your phone (same WiFi or via Cloudflare Tunnel) and stay in control from anywhere.

## Quick Start

```bash
# Clone
git clone https://github.com/rohitp-bsf/claude-mobile-companion.git
cd claude-mobile-companion

# Setup
cp .env.example server/.env  # edit PIN
npm install

# Run
npm run dev

# Open the LAN URL shown in terminal on your phone
```

## Architecture

```
Phone (PWA)  ←──WebSocket──→  Bridge Server (Node.js)  ←──SDK──→  Claude Code
```

- **Server**: Express + WebSocket server wrapping `@anthropic-ai/claude-code` SDK
- **Mobile**: React PWA with Tailwind — optimized for touch, works offline
- **Auth**: PIN-based (hashed, never stored in plain text)
- **Access**: LAN (same WiFi) or Cloudflare Tunnel (remote)

## Features

### Phase 1 (MVP) ✅
- [x] Project scaffolding
- [ ] WebSocket streaming of Claude output
- [ ] PIN authentication
- [ ] Session list dashboard
- [ ] Live session view with auto-scroll
- [ ] LAN access with QR code

### Phase 2 (Interactive)
- [ ] Tool approval/rejection from mobile
- [ ] Send messages to active sessions
- [ ] Start new sessions from phone
- [ ] Push notifications (approval needed, session complete)

### Phase 3 (Polish)
- [ ] PWA installable (home screen)
- [ ] Markdown rendering
- [ ] File diff viewer for Edit approvals
- [ ] Session history (SQLite)
- [ ] Dark/light theme
- [ ] Auto-reconnect on network changes

### Phase 4 (Power)
- [ ] Voice input
- [ ] Auto-approve patterns
- [ ] Scheduled sessions
- [ ] Multi-machine support

## Remote Access (Cloudflare Tunnel)

```bash
# Install cloudflared
brew install cloudflared

# Create tunnel (one-time)
cloudflared tunnel create claude-companion
cloudflared tunnel route dns claude-companion claude.yourdomain.com

# Run (add to your startup)
cloudflared tunnel run --url http://localhost:3099 claude-companion
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Server | Node.js, Express, ws, Claude Code SDK |
| Mobile | React 19, Tailwind CSS, Vite |
| PWA | vite-plugin-pwa |
| Auth | PIN → SHA-256 hash |
| Access | LAN / Cloudflare Tunnel |
| Storage | SQLite (planned) |
