import { EventEmitter } from 'events';
import crypto from 'crypto';
import type { SessionInfo, SessionStatus, ToolCallInfo } from '@claude-companion/shared';
import { TranscriptWatcher } from './transcript-watcher';

interface PendingApproval {
    id: string;
    toolName: string;
    toolInput: unknown;
    resolve: (result: { decision: 'approve' } | { decision: 'block'; reason: string }) => void;
    timer: NodeJS.Timeout;
}

interface PendingMessage {
    resolve: (result: Record<string, unknown>) => void;
    timer: NodeJS.Timeout;
}

interface CliSession {
    sessionId: string;
    cwd: string;
    transcriptPath: string;
    status: SessionStatus;
    createdAt: number;
    lastActivityAt: number;
    pendingApproval?: PendingApproval;
    pendingMessage?: PendingMessage;
    messages: Array<{ type: string; content: string; timestamp: number }>;
}

const APPROVAL_TIMEOUT = 5 * 60 * 1000; // 5 min
const MESSAGE_TIMEOUT = 5 * 60 * 1000;  // 5 min

/**
 * Tracks CLI sessions registered via hooks.
 * Emits: 'session_registered', 'output', 'approval_needed', 'waiting_input', 'session_update'
 */
export class CliSessionTracker extends EventEmitter {
    private sessions = new Map<string, CliSession>();
    private transcriptWatcher = new TranscriptWatcher();

    constructor() {
        super();
        // Forward transcript text to mobile as output
        this.transcriptWatcher.on('text', ({ sessionId, content }) => {
            const session = this.sessions.get(sessionId);
            if (session) {
                session.lastActivityAt = Date.now();
                session.messages.push({ type: 'text', content, timestamp: Date.now() });
                this.emit('output', { sessionId, content });
            }
        });
    }

    /** Handle SessionStart hook */
    registerSession(sessionId: string, cwd: string, transcriptPath: string): void {
        if (this.sessions.has(sessionId)) {
            // Update existing — CLI may restart
            const s = this.sessions.get(sessionId)!;
            s.lastActivityAt = Date.now();
            s.status = 'running';
            return;
        }

        const session: CliSession = {
            sessionId,
            cwd,
            transcriptPath,
            status: 'running',
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
            messages: [],
        };
        this.sessions.set(sessionId, session);

        // Start watching transcript file for assistant text output
        if (transcriptPath) {
            this.transcriptWatcher.watch(sessionId, transcriptPath);
        }

        this.emit('session_registered', { sessionId });
    }

    /** Handle PreToolUse hook — returns a Promise that resolves when mobile approves/rejects */
    handlePreToolUse(
        sessionId: string,
        toolName: string,
        toolInput: unknown,
    ): Promise<{ decision: 'approve' } | { decision: 'block'; reason: string }> {
        const session = this.getOrCreate(sessionId);
        session.lastActivityAt = Date.now();

        // Cancel any previous pending approval
        if (session.pendingApproval) {
            clearTimeout(session.pendingApproval.timer);
            session.pendingApproval.resolve({ decision: 'approve' });
        }

        const approvalId = crypto.randomUUID();

        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                // Auto-approve on timeout
                session.pendingApproval = undefined;
                session.status = 'running';
                resolve({ decision: 'approve' });
            }, APPROVAL_TIMEOUT);

            session.pendingApproval = { id: approvalId, toolName, toolInput, resolve, timer };
            session.status = 'waiting_approval';

            const toolCall: ToolCallInfo = {
                id: approvalId,
                name: toolName,
                input: (toolInput && typeof toolInput === 'object' ? toolInput : {}) as Record<string, unknown>,
                description: this.summarizeTool(toolName, toolInput),
            };

            this.emit('approval_needed', { sessionId, toolCall });
            this.emit('session_update', { sessionId });
        });
    }

    /** Handle PostToolUse hook — fire and forget */
    handlePostToolUse(sessionId: string, toolName: string, toolInput: unknown, toolResponse: unknown): void {
        const session = this.getOrCreate(sessionId);
        session.lastActivityAt = Date.now();
        session.status = 'running';
        session.pendingApproval = undefined;

        const content = `[${toolName}] completed`;
        session.messages.push({ type: 'tool_result', content, timestamp: Date.now() });

        this.emit('output', { sessionId, content });
        this.emit('session_update', { sessionId });
    }

    /** Handle Stop hook — returns a Promise that resolves when mobile sends a message or timeout */
    handleStop(sessionId: string): Promise<Record<string, unknown>> {
        const session = this.getOrCreate(sessionId);
        session.lastActivityAt = Date.now();
        session.status = 'waiting_input';
        session.pendingApproval = undefined;

        // Cancel any previous pending message wait
        if (session.pendingMessage) {
            clearTimeout(session.pendingMessage.timer);
            session.pendingMessage.resolve({});
        }

        this.emit('waiting_input', { sessionId });
        this.emit('session_update', { sessionId });

        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                session.pendingMessage = undefined;
                session.status = 'running';
                this.emit('session_update', { sessionId });
                resolve({});
            }, MESSAGE_TIMEOUT);

            session.pendingMessage = { resolve, timer };
        });
    }

    /** Handle Notification hook — fire and forget */
    handleNotification(sessionId: string, message: string, title?: string): void {
        const session = this.getOrCreate(sessionId);
        session.lastActivityAt = Date.now();

        this.emit('notification', { sessionId, message, title });
    }

    /** Mobile approves a tool call */
    approve(sessionId: string, _toolCallId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session?.pendingApproval) return false;

        clearTimeout(session.pendingApproval.timer);
        session.pendingApproval.resolve({ decision: 'approve' });
        session.pendingApproval = undefined;
        session.status = 'running';
        this.emit('session_update', { sessionId });
        return true;
    }

    /** Mobile rejects a tool call */
    reject(sessionId: string, _toolCallId: string, reason?: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session?.pendingApproval) return false;

        clearTimeout(session.pendingApproval.timer);
        session.pendingApproval.resolve({ decision: 'block', reason: reason || 'Rejected from mobile' });
        session.pendingApproval = undefined;
        session.status = 'running';
        this.emit('session_update', { sessionId });
        return true;
    }

    /** Mobile sends a message to a CLI session waiting for input */
    sendMessage(sessionId: string, text: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session?.pendingMessage) return false;

        clearTimeout(session.pendingMessage.timer);
        session.pendingMessage.resolve({
            continue: true,
            systemMessage: `User sent from mobile: ${text}`,
        });
        session.pendingMessage = undefined;
        session.status = 'running';
        this.emit('session_update', { sessionId });
        return true;
    }

    /** Get all CLI sessions as SessionInfo[] */
    listSessions(): SessionInfo[] {
        return Array.from(this.sessions.values()).map((s) => this.toSessionInfo(s));
    }

    /** Check if a session ID belongs to a CLI session */
    has(sessionId: string): boolean {
        return this.sessions.has(sessionId);
    }

    /** Clean up stale sessions (no activity for 30 min) */
    cleanup(): void {
        const cutoff = Date.now() - 30 * 60 * 1000;
        for (const [id, session] of this.sessions) {
            if (session.lastActivityAt < cutoff && !session.pendingApproval && !session.pendingMessage) {
                this.transcriptWatcher.unwatch(id);
                this.sessions.delete(id);
            }
        }
    }

    private getOrCreate(sessionId: string): CliSession {
        if (!this.sessions.has(sessionId)) {
            this.registerSession(sessionId, '', '');
        }
        return this.sessions.get(sessionId)!;
    }

    private toSessionInfo(session: CliSession): SessionInfo {
        const info: SessionInfo = {
            id: session.sessionId,
            cwd: session.cwd,
            prompt: '(CLI session)',
            status: session.status,
            createdAt: session.createdAt,
            lastActivityAt: session.lastActivityAt,
            source: 'cli',
        };

        if (session.pendingApproval) {
            info.pendingApproval = {
                id: session.pendingApproval.id,
                name: session.pendingApproval.toolName,
                input: (session.pendingApproval.toolInput && typeof session.pendingApproval.toolInput === 'object'
                    ? session.pendingApproval.toolInput
                    : {}) as Record<string, unknown>,
                description: this.summarizeTool(session.pendingApproval.toolName, session.pendingApproval.toolInput),
            };
        }

        return info;
    }

    private summarizeTool(name: string, input: unknown): string {
        const inp = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
        switch (name) {
            case 'Read':
                return `Read file: ${inp.file_path || 'unknown'}`;
            case 'Write':
                return `Write file: ${inp.file_path || 'unknown'}`;
            case 'Edit':
                return `Edit file: ${inp.file_path || 'unknown'}`;
            case 'Bash':
                return `Run command: ${String(inp.command || '').slice(0, 100)}`;
            case 'Glob':
                return `Search files: ${inp.pattern || 'unknown'}`;
            case 'Grep':
                return `Search content: ${inp.pattern || 'unknown'}`;
            default:
                return `Tool: ${name}`;
        }
    }
}
