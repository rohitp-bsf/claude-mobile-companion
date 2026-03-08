import { useState, useEffect, useRef, useCallback } from 'react';
import type { ServerMessage, ClientMessage, SessionInfo } from '../../../shared/src/index';

const WS_RECONNECT_DELAY = 3000;
const MAX_RECONNECT = 10;

const STORAGE_KEY_SERVER = 'claude-companion-server-url';
const STORAGE_KEY_PIN = 'claude-companion-pin';

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
    const [serverUrl, setServerUrl] = useState(() => localStorage.getItem(STORAGE_KEY_SERVER) || '');
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [messages, setMessages] = useState<WSMessage[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectCount = useRef(0);
    const pinRef = useRef(localStorage.getItem(STORAGE_KEY_PIN) || '');
    const serverUrlRef = useRef(serverUrl);

    const send = useCallback((msg: ClientMessage) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
    }, []);

    const buildWsUrl = useCallback((url: string) => {
        // Convert HTTP URL to WebSocket URL
        let wsUrl = url.trim().replace(/\/+$/, '');
        if (wsUrl.startsWith('https://')) {
            wsUrl = 'wss://' + wsUrl.slice(8);
        } else if (wsUrl.startsWith('http://')) {
            wsUrl = 'ws://' + wsUrl.slice(7);
        } else if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
            // Default to wss for ngrok/remote, ws for localhost/LAN
            const isLocal = wsUrl.includes('localhost') || wsUrl.includes('192.168.') || wsUrl.includes('10.');
            wsUrl = (isLocal ? 'ws://' : 'wss://') + wsUrl;
        }
        return wsUrl;
    }, []);

    const disconnect = useCallback(() => {
        reconnectCount.current = MAX_RECONNECT; // prevent auto-reconnect
        wsRef.current?.close();
        wsRef.current = null;
        setIsConnected(false);
        setIsAuthenticated(false);
        setConnecting(false);
    }, []);

    const connect = useCallback((url: string, pin: string) => {
        // Close existing connection
        if (wsRef.current) {
            reconnectCount.current = MAX_RECONNECT;
            wsRef.current.close();
        }

        serverUrlRef.current = url;
        pinRef.current = pin;
        reconnectCount.current = 0;
        setConnecting(true);
        setAuthError('');

        const wsUrl = buildWsUrl(url);

        const doConnect = () => {
            let ws: WebSocket;
            try {
                ws = new WebSocket(wsUrl);
            } catch {
                setAuthError('Invalid server URL');
                setConnecting(false);
                return;
            }
            wsRef.current = ws;

            ws.onopen = () => {
                setIsConnected(true);
                setConnecting(false);
                reconnectCount.current = 0;
                // Authenticate immediately
                send({ type: 'auth', pin: pinRef.current });
            };

            ws.onmessage = (event) => {
                try {
                    const msg: ServerMessage = JSON.parse(event.data);
                    handleMessage(msg);
                } catch {
                    // ignore malformed messages
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                if (reconnectCount.current < MAX_RECONNECT) {
                    reconnectCount.current++;
                    setConnecting(true);
                    setTimeout(doConnect, WS_RECONNECT_DELAY);
                } else {
                    setConnecting(false);
                }
            };

            ws.onerror = () => {
                ws.close();
            };
        };

        const handleMessage = (msg: ServerMessage) => {
            switch (msg.type) {
                case 'auth_success':
                    setIsAuthenticated(true);
                    setAuthError('');
                    // Persist successful connection
                    localStorage.setItem(STORAGE_KEY_SERVER, serverUrlRef.current);
                    localStorage.setItem(STORAGE_KEY_PIN, pinRef.current);
                    break;

                case 'auth_failed':
                    setIsAuthenticated(false);
                    setAuthError(msg.reason);
                    // Don't reconnect on auth failure
                    reconnectCount.current = MAX_RECONNECT;
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

        doConnect();
    }, [buildWsUrl, send]);

    // Ping keepalive
    useEffect(() => {
        const interval = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                send({ type: 'ping' });
            }
        }, 25000);
        return () => clearInterval(interval);
    }, [send]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            wsRef.current?.close();
        };
    }, []);

    return {
        serverUrl,
        savedPin: pinRef.current,
        isConnected,
        isAuthenticated,
        authError,
        connecting,
        sessions,
        messages,

        connect: (url: string, pin: string) => {
            setServerUrl(url);
            connect(url, pin);
        },

        disconnect,

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
