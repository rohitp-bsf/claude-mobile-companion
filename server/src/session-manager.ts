import { nanoid } from 'nanoid';
import { ClaudeBridge, type ClaudeSession } from './claude-bridge';
import type { SessionInfo, ToolCallInfo } from '@claude-companion/shared';
import { EventEmitter } from 'events';

export class SessionManager extends EventEmitter {
    private sessions = new Map<string, ClaudeSession>();
    private bridge = new ClaudeBridge();

    constructor() {
        super();

        // Forward bridge events
        this.bridge.on('output', (data) => this.emit('output', data));
        this.bridge.on('approval_needed', (data) => this.emit('approval_needed', data));
        this.bridge.on('complete', (data) => this.emit('complete', data));
        this.bridge.on('error', (data) => this.emit('error', data));
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

    listSessions(): SessionInfo[] {
        return Array.from(this.sessions.values()).map((s) => this.toSessionInfo(s));
    }

    getSession(id: string): SessionInfo | null {
        const session = this.sessions.get(id);
        return session ? this.toSessionInfo(session) : null;
    }

    approve(sessionId: string, _toolCallId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== 'waiting_approval') return false;

        session.status = 'running';
        session.pendingApproval = undefined;
        // Note: actual approval mechanism depends on Claude Code SDK's
        // permission handling. For MVP, we run with allowedTools and
        // the SDK handles permissions automatically.
        return true;
    }

    reject(sessionId: string, _toolCallId: string, _reason?: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== 'waiting_approval') return false;

        session.status = 'running';
        session.pendingApproval = undefined;
        return true;
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
            pendingApproval: session.pendingApproval,
        };
    }
}
