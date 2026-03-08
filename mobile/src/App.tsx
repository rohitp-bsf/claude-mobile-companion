import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import LoginScreen from './pages/LoginScreen';
import Dashboard from './pages/Dashboard';
import Session from './pages/Session';

type Screen = 'dashboard' | { type: 'session'; sessionId: string };

/**
 * Read and consume deep-link params from URL.
 * QR code encodes: ?server=<url>&pin=<pin>
 */
function consumeDeepLinkParams(): { server: string; pin: string } | null {
    const params = new URLSearchParams(window.location.search);
    const server = params.get('server');
    const pin = params.get('pin');

    if (server && pin) {
        // Clean URL without reloading (remove credentials from address bar / history)
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
        return { server, pin };
    }
    return null;
}

export default function App() {
    const [screen, setScreen] = useState<Screen>('dashboard');
    const ws = useWebSocket();
    const autoConnectAttempted = useRef(false);

    // Auto-connect from QR deep link or saved credentials
    useEffect(() => {
        if (autoConnectAttempted.current || ws.isAuthenticated) return;
        autoConnectAttempted.current = true;

        // Priority 1: Deep link params (from QR scan)
        const deepLink = consumeDeepLinkParams();
        if (deepLink) {
            ws.connect(deepLink.server, deepLink.pin);
            return;
        }

        // Priority 2: Saved credentials in localStorage
        if (ws.serverUrl && ws.savedPin) {
            ws.connect(ws.serverUrl, ws.savedPin);
        }
    }, [ws]);

    if (!ws.isAuthenticated) {
        return (
            <LoginScreen
                onConnect={(url, pin) => ws.connect(url, pin)}
                error={ws.authError}
                connecting={ws.connecting}
                savedServerUrl={ws.serverUrl}
                savedPin={ws.savedPin}
            />
        );
    }

    if (typeof screen === 'object' && screen.type === 'session') {
        return (
            <Session
                sessionId={screen.sessionId}
                messages={ws.messages.filter((m) => m.sessionId === screen.sessionId)}
                sessions={ws.sessions}
                onBack={() => setScreen('dashboard')}
                onApprove={(toolCallId) => ws.approve(screen.sessionId, toolCallId)}
                onReject={(toolCallId, reason) => ws.reject(screen.sessionId, toolCallId, reason)}
                onSendMessage={(text) => ws.sendMessage(screen.sessionId, text)}
                onAbort={() => ws.abort(screen.sessionId)}
            />
        );
    }

    return (
        <Dashboard
            sessions={ws.sessions}
            onSelectSession={(id) => setScreen({ type: 'session', sessionId: id })}
            onNewSession={(cwd, prompt) => ws.newSession(cwd, prompt)}
            onDisconnect={ws.disconnect}
            serverUrl={ws.serverUrl}
        />
    );
}
