import { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import LoginScreen from './pages/LoginScreen';
import Dashboard from './pages/Dashboard';
import Session from './pages/Session';

type Screen = 'dashboard' | { type: 'session'; sessionId: string };

export default function App() {
    const [screen, setScreen] = useState<Screen>('dashboard');
    const ws = useWebSocket();

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
