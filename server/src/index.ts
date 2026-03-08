import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_PORT } from '@claude-companion/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { WSHandler } from './ws-handler';
import { SessionManager } from './session-manager';
import { AuthManager } from './auth';
import { printStartupBanner } from './banner';

const PORT = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
const PIN = process.env.PIN || '';

if (!PIN) {
    console.error('ERROR: PIN is required. Set PIN in .env or pass PIN=xxxx');
    process.exit(1);
}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const auth = new AuthManager(PIN);
const sessionManager = new SessionManager();
const wsHandler = new WSHandler(wss, auth, sessionManager);

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

server.listen(PORT, '0.0.0.0', () => {
    printStartupBanner(PORT);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    sessionManager.abortAll();
    wsHandler.closeAll();
    server.close(() => process.exit(0));
});
