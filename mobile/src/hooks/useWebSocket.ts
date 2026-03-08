import { useState, useEffect, useRef, useCallback } from 'react';
import type { ServerMessage, ClientMessage, SessionInfo } from '../../../shared/src/index';

const WS_RECONNECT_DELAY = 3000;
const MAX_RECONNECT = 10;

export interface WSMessage {
    sessionId: string;
    type: 'output' | 'approval' | 'complete' | 'error';
    content: string;
    toolCall?: {
        id: string;
        name: string;
        input: Record<string, unknown>;
        description?: string;
    };
    timestamp: number;
}

export function useWebSocket() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState('');
    const [connecting, setConnecting] = useState(true);
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [messages, setMessages] = useState<WSMessage[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectCount = useRef(0);
    const pinRef = useRef('');

    const getWsUrl = useCallback(() => {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${proto}//${window.location.host}`;
    }, []);

    const send = useCallback((msg: ClientMessage) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
    }, []);

    const connect = useCallback(() => {
        const ws = new WebSocket(getWsUrl());
        wsRef.current = ws;

        ws.onopen = () => {
            setConnecting(false);
            reconnectCount.current = 0;
            // Re-authenticate on reconnect
            if (pinRef.current) {
                send({ type: 'auth', pin: pinRef.current });
            }
        };

        ws.onmessage = (event) => {
            const msg: ServerMessage = JSON.parse(event.data);

            switch (msg.type) {
                case 'auth_success':
                    setIsAuthenticated(true);
                    setAuthError('');
                    break;

                case 'auth_failed':
                    setIsAuthenticated(false);
                    setAuthError(msg.reason);
                    break;

                case 'sessions_list':
                    setSessions(msg.sessions);
                    break;

                case 'session_started':
                    setSessions((prev) => [
                        ...prev,
                        {
                            id: msg.sessionId,
                            cwd: msg.cwd,
                            prompt: msg.prompt,
                            status: 'running',
                            createdAt: msg.timestamp,
                            lastActivityAt: msg.timestamp,
                        },
                    ]);
                    break;

                case 'output':
                    setMessages((prev) => [
                        ...prev,
                        {
                            sessionId: msg.sessionId,
                            type: 'output',
                            content: msg.content,
                            timestamp: msg.timestamp,
                        },
                    ]);
                    break;

                case 'approval_needed':
                    setMessages((prev) => [
                        ...prev,
                        {
                            sessionId: msg.sessionId,
                            type: 'approval',
                            content: msg.toolCall.description || `Tool: ${msg.toolCall.name}`,
                            toolCall: msg.toolCall,
                            timestamp: msg.timestamp,
                        },
                    ]);
                    setSessions((prev) =>
                        prev.map((s) =>
                            s.id === msg.sessionId
                                ? { ...s, status: 'waiting_approval' as const, pendingApproval: msg.toolCall }
                                : s,
                        ),
                    );
                    break;

                case 'session_complete':
                    setMessages((prev) => [
                        ...prev,
                        {
                            sessionId: msg.sessionId,
                            type: 'complete',
                            content: 'Session completed',
                            timestamp: msg.timestamp,
                        },
                    ]);
                    setSessions((prev) =>
                        prev.map((s) =>
                            s.id === msg.sessionId ? { ...s, status: 'completed' as const } : s,
                        ),
                    );
                    break;

                case 'session_error':
                    setMessages((prev) => [
                        ...prev,
                        {
                            sessionId: msg.sessionId,
                            type: 'error',
                            content: msg.error,
                            timestamp: msg.timestamp,
                        },
                    ]);
                    setSessions((prev) =>
                        prev.map((s) =>
                            s.id === msg.sessionId ? { ...s, status: 'error' as const } : s,
                        ),
                    );
                    break;

                case 'pong':
                    break;
            }
        };

        ws.onclose = () => {
            setConnecting(true);
            if (reconnectCount.current < MAX_RECONNECT) {
                reconnectCount.current++;
                setTimeout(connect, WS_RECONNECT_DELAY);
            }
        };

        ws.onerror = () => {
            ws.close();
        };
    }, [getWsUrl, send]);

    useEffect(() => {
        connect();
        return () => {
            wsRef.current?.close();
        };
    }, [connect]);

    // Ping keepalive
    useEffect(() => {
        const interval = setInterval(() => {
            send({ type: 'ping' });
        }, 25000);
        return () => clearInterval(interval);
    }, [send]);

    return {
        isAuthenticated,
        authError,
        connecting,
        sessions,
        messages,

        authenticate: (pin: string) => {
            pinRef.current = pin;
            send({ type: 'auth', pin });
        },

        newSession: (cwd: string, prompt: string) => {
            send({ type: 'new_session', cwd, prompt });
        },

        sendMessage: (sessionId: string, text: string) => {
            send({ type: 'send_message', sessionId, text });
        },

        approve: (sessionId: string, toolCallId: string) => {
            send({ type: 'approve', sessionId, toolCallId });
        },

        reject: (sessionId: string, toolCallId: string, reason?: string) => {
            send({ type: 'reject', sessionId, toolCallId, reason });
        },

        abort: (sessionId: string) => {
            send({ type: 'abort_session', sessionId });
        },
    };
}
