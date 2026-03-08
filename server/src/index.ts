import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import crypto from 'crypto';
import os from 'os';
import { DEFAULT_PORT } from '@claude-companion/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { WSHandler } from './ws-handler';
import { SessionManager } from './session-manager';
import { AuthManager } from './auth';
import { createHookRouter } from './hook-api';
import { printStartupBanner } from './banner';

const PORT = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
const TOKEN_FILE = path.join(os.homedir(), '.claude-companion-token');

/**
 * Get or generate the auth token.
 * Priority: PIN env var > existing token file > generate new token.
 */
function resolveToken(): string {
    // Explicit PIN from env takes priority
    if (process.env.PIN) return process.env.PIN;

    // Read existing token file
    if (existsSync(TOKEN_FILE)) {
        const existing = readFileSync(TOKEN_FILE, 'utf-8').trim();
        if (existing) return existing;
    }

    // Generate a new secure token
    const token = crypto.randomBytes(16).toString('hex');
    writeFileSync(TOKEN_FILE, token, { mode: 0o600 }); // owner-only read/write
    console.log(`Generated new auth token → ${TOKEN_FILE}`);
    return token;
}

const PIN = resolveToken();

const app = express();

// CORS — allow PWA hosted on GitHub Pages to connect
app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Pin');
    next();
});

// Parse JSON bodies for hook API
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const auth = new AuthManager(PIN);
const sessionManager = new SessionManager();
const wsHandler = new WSHandler(wss, auth, sessionManager);

// Mount hook API for CLI sessions
const hookRouter = createHookRouter(sessionManager.cliTracker, auth);
app.use('/api/hooks', hookRouter);

// Serve mobile PWA static files in production
const mobileDist = path.join(__dirname, '../../mobile/dist');
app.use(express.static(mobileDist));

// Health check endpoint
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        sessions: sessionManager.listSessions().length,
        uptime: process.uptime(),
    });
});

// SPA fallback — serve index.html for all non-API routes
app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(mobileDist, 'index.html'));
});

server.listen(PORT, '0.0.0.0', async () => {
    await printStartupBanner(PORT, PIN);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    sessionManager.abortAll();
    wsHandler.closeAll();
    server.close(() => process.exit(0));
});
