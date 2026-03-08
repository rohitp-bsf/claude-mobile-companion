// ─── WebSocket Message Protocol ───

// Server → Mobile
export type ServerMessage =
    | { type: 'output'; sessionId: string; content: string; timestamp: number }
    | { type: 'approval_needed'; sessionId: string; toolCall: ToolCallInfo; timestamp: number }
    | { type: 'session_started'; sessionId: string; cwd: string; prompt: string; timestamp: number }
    | { type: 'session_complete'; sessionId: string; timestamp: number }
    | { type: 'session_error'; sessionId: string; error: string; timestamp: number }
    | { type: 'sessions_list'; sessions: SessionInfo[] }
    | { type: 'auth_success' }
    | { type: 'auth_failed'; reason: string }
    | { type: 'pong' };

// Mobile → Server
export type ClientMessage =
    | { type: 'auth'; pin: string }
    | { type: 'approve'; sessionId: string; toolCallId: string }
    | { type: 'reject'; sessionId: string; toolCallId: string; reason?: string }
    | { type: 'send_message'; sessionId: string; text: string }
    | { type: 'new_session'; cwd: string; prompt: string }
    | { type: 'abort_session'; sessionId: string }
    | { type: 'list_sessions' }
    | { type: 'ping' };

// ─── Shared Types ───

export interface ToolCallInfo {
    id: string;
    name: string;
    input: Record<string, unknown>;
    /** Human-readable summary of what the tool will do */
    description?: string;
}

export interface SessionInfo {
    id: string;
    cwd: string;
    prompt: string;
    status: SessionStatus;
    createdAt: number;
    lastActivityAt: number;
    /** Set when a tool call is awaiting approval */
    pendingApproval?: ToolCallInfo;
}

export type SessionStatus =
    | 'running'
    | 'waiting_approval'
    | 'waiting_input'
    | 'completed'
    | 'error'
    | 'aborted';

// ─── Constants ───

export const WS_PING_INTERVAL = 30_000;
export const WS_RECONNECT_DELAY = 3_000;
export const MAX_RECONNECT_ATTEMPTS = 10;
export const DEFAULT_PORT = 3099;
