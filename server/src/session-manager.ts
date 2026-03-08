import { nanoid } from 'nanoid';
import { ClaudeBridge, type ClaudeSession } from './claude-bridge';
import type { SessionInfo } from '@claude-companion/shared';
import { EventEmitter } from 'events';
import { CliSessionTracker } from './cli-session-tracker';

export class SessionManager extends EventEmitter {
    private sessions = new Map<string, ClaudeSession>();
    private bridge = new ClaudeBridge();
    readonly cliTracker = new CliSessionTracker();

    constructor() {
        super();

        // Forward SDK bridge events
        this.bridge.on('output', (data) => this.emit('output', data));
        this.bridge.on('approval_needed', (data) => this.emit('approval_needed', data));
        this.bridge.on('complete', (data) => this.emit('complete', data));
        this.bridge.on('error', (data) => this.emit('error', data));

        // Forward CLI tracker events
        this.cliTracker.on('session_registered', (data) => this.emit('session_registered', data));
        this.cliTracker.on('output', (data) => this.emit('cli_output', data));
        this.cliTracker.on('approval_needed', (data) => this.emit('cli_approval_needed', data));
        this.cliTracker.on('waiting_input', (data) => this.emit('cli_waiting_input', data));
        this.cliTracker.on('session_update', (data) => this.emit('cli_session_update', data));
        this.cliTracker.on('notification', (data) => this.emit('cli_notification', data));

        // Periodic cleanup of stale CLI sessions
        setInterval(() => this.cliTracker.cleanup(), 10 * 60 * 1000);
    }

    async createSession(cwd: string, prompt: string): Promise<SessionInfo> {
        const id = nanoid(10);
        const now = Date.now();

        const session: ClaudeSession = {
            id,
            cwd,
            prompt,
            status: 'running',
            createdAt: now,
            lastActivityAt: now,
            abortController: new AbortController(),
        };

        this.sessions.set(id, session);

        // Run in background — don't await
        this.bridge.run(session).catch((err) => {
            console.error(`Session ${id} crashed:`, err);
        });

        return this.toSessionInfo(session);
    }

    /** Returns both SDK and CLI sessions merged */
    listSessions(): SessionInfo[] {
        const sdkSessions = Array.from(this.sessions.values()).map((s) => this.toSessionInfo(s));
        const cliSessions = this.cliTracker.listSessions();
        return [...sdkSessions, ...cliSessions];
    }

    getSession(id: string): SessionInfo | null {
        const session = this.sessions.get(id);
        return session ? this.toSessionInfo(session) : null;
    }

    approve(sessionId: string, toolCallId: string): boolean {
        // Try CLI first
        if (this.cliTracker.has(sessionId)) {
            return this.cliTracker.approve(sessionId, toolCallId);
        }

        // SDK session
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== 'waiting_approval') return false;

        this.bridge.resolvePermission(session, true);
        return true;
    }

    reject(sessionId: string, toolCallId: string, reason?: string): boolean {
        // Try CLI first
        if (this.cliTracker.has(sessionId)) {
            return this.cliTracker.reject(sessionId, toolCallId, reason);
        }

        // SDK session
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== 'waiting_approval') return false;

        this.bridge.resolvePermission(session, false, reason);
        return true;
    }

    sendMessage(sessionId: string, text: string): boolean {
        // CLI sessions support message injection via Stop hook
        if (this.cliTracker.has(sessionId)) {
            return this.cliTracker.sendMessage(sessionId, text);
        }

        // SDK sessions — not yet supported
        return false;
    }

    abort(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        session.status = 'aborted';
        session.abortController.abort();
        return true;
    }

    abortAll(): void {
        for (const session of this.sessions.values()) {
            if (session.status === 'running' || session.status === 'waiting_approval') {
                session.status = 'aborted';
                session.abortController.abort();
            }
        }
    }

    private toSessionInfo(session: ClaudeSession): SessionInfo {
        return {
            id: session.id,
            cwd: session.cwd,
            prompt: session.prompt,
            status: session.status,
            createdAt: session.createdAt,
            lastActivityAt: session.lastActivityAt,
            source: 'sdk',
            pendingApproval: session.pendingApproval,
        };
    }
}
