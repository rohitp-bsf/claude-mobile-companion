import { WebSocketServer, WebSocket } from 'ws';
import type { ServerMessage, ClientMessage } from '@claude-companion/shared';
import { WS_PING_INTERVAL } from '@claude-companion/shared';
import { AuthManager } from './auth';
import { SessionManager } from './session-manager';

interface AuthenticatedSocket extends WebSocket {
    isAuthenticated?: boolean;
    authToken?: string;
    isAlive?: boolean;
}

export class WSHandler {
    private clients = new Set<AuthenticatedSocket>();
    private pingInterval: ReturnType<typeof setInterval>;

    constructor(
        private wss: WebSocketServer,
        private auth: AuthManager,
        private sessionManager: SessionManager,
    ) {
        this.setupWSS();
        this.setupSessionEvents();

        // Heartbeat to detect dead connections
        this.pingInterval = setInterval(() => {
            this.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    ws.terminate();
                    this.clients.delete(ws);
                    return;
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, WS_PING_INTERVAL);
    }

    closeAll(): void {
        clearInterval(this.pingInterval);
        this.clients.forEach((ws) => ws.close());
        this.clients.clear();
    }

    private setupWSS(): void {
        this.wss.on('connection', (ws: AuthenticatedSocket) => {
            ws.isAlive = true;
            ws.isAuthenticated = false;
            this.clients.add(ws);

            ws.on('pong', () => {
                ws.isAlive = true;
            });

            ws.on('message', (data) => {
                try {
                    const msg: ClientMessage = JSON.parse(data.toString());
                    this.handleMessage(ws, msg);
                } catch {
                    this.send(ws, { type: 'auth_failed', reason: 'Invalid message format' });
                }
            });

            ws.on('close', () => {
                this.clients.delete(ws);
                if (ws.authToken) {
                    this.auth.revokeToken(ws.authToken);
                }
            });
        });
    }

    private handleMessage(ws: AuthenticatedSocket, msg: ClientMessage): void {
        // Auth gate — only 'auth' and 'ping' allowed before authentication
        if (!ws.isAuthenticated && msg.type !== 'auth' && msg.type !== 'ping') {
            this.send(ws, { type: 'auth_failed', reason: 'Not authenticated' });
            return;
        }

        switch (msg.type) {
            case 'auth':
                this.handleAuth(ws, msg.pin);
                break;

            case 'ping':
                this.send(ws, { type: 'pong' });
                break;

            case 'list_sessions':
                this.send(ws, {
                    type: 'sessions_list',
                    sessions: this.sessionManager.listSessions(),
                });
                break;

            case 'new_session':
                this.handleNewSession(ws, msg.cwd, msg.prompt);
                break;

            case 'send_message':
                // TODO: Implement message injection into running session
                // This requires Claude Code SDK support for mid-session input
                console.log(`Message for session ${msg.sessionId}: ${msg.text}`);
                break;

            case 'approve':
                this.sessionManager.approve(msg.sessionId, msg.toolCallId);
                break;

            case 'reject':
                this.sessionManager.reject(msg.sessionId, msg.toolCallId, msg.reason);
                break;

            case 'abort_session':
                this.sessionManager.abort(msg.sessionId);
                break;
        }
    }

    private handleAuth(ws: AuthenticatedSocket, pin: string): void {
        if (this.auth.validate(pin)) {
            ws.isAuthenticated = true;
            ws.authToken = this.auth.createToken();
            this.send(ws, { type: 'auth_success' });

            // Send current sessions list
            this.send(ws, {
                type: 'sessions_list',
                sessions: this.sessionManager.listSessions(),
            });
        } else {
            this.send(ws, { type: 'auth_failed', reason: 'Invalid PIN' });
        }
    }

    private async handleNewSession(ws: AuthenticatedSocket, cwd: string, prompt: string): Promise<void> {
        try {
            const session = await this.sessionManager.createSession(cwd, prompt);
            this.send(ws, {
                type: 'session_started',
                sessionId: session.id,
                cwd: session.cwd,
                prompt: session.prompt,
                timestamp: Date.now(),
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.send(ws, {
                type: 'session_error',
                sessionId: '',
                error: message,
                timestamp: Date.now(),
            });
        }
    }

    private setupSessionEvents(): void {
        this.sessionManager.on('output', (data) => {
            this.broadcast({
                type: 'output',
                sessionId: data.sessionId,
                content: data.content,
                timestamp: Date.now(),
            });
        });

        this.sessionManager.on('approval_needed', (data) => {
            this.broadcast({
                type: 'approval_needed',
                sessionId: data.sessionId,
                toolCall: data.toolCall,
                timestamp: Date.now(),
            });
        });

        this.sessionManager.on('complete', (data) => {
            this.broadcast({
                type: 'session_complete',
                sessionId: data.sessionId,
                timestamp: Date.now(),
            });
        });

        this.sessionManager.on('error', (data) => {
            this.broadcast({
                type: 'session_error',
                sessionId: data.sessionId,
                error: data.error,
                timestamp: Date.now(),
            });
        });
    }

    /** Send to all authenticated clients */
    private broadcast(msg: ServerMessage): void {
        for (const client of this.clients) {
            if (client.isAuthenticated && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(msg));
            }
        }
    }

    /** Send to a specific client */
    private send(ws: WebSocket, msg: ServerMessage): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
        }
    }
}
