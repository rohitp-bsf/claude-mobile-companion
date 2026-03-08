import { useState } from 'react';

interface Props {
    onLogin: (pin: string) => void;
    error: string;
    connecting: boolean;
}

export default function LoginScreen({ onLogin, error, connecting }: Props) {
    const [pin, setPin] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.length >= 4) {
            onLogin(pin);
        }
    };

    if (connecting) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6">
                <div className="w-8 h-8 border-2 border-claude-500 border-t-transparent rounded-full animate-spin" />
                <p className="mt-4 text-slate-400 text-sm">Connecting to server...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-claude-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-claude-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-semibold">Claude Companion</h1>
                    <p className="text-slate-400 text-sm mt-1">Enter your PIN to connect</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoFocus
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        placeholder="Enter PIN"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-center text-2xl tracking-[0.5em] placeholder:tracking-normal placeholder:text-base focus:outline-none focus:border-claude-500 focus:ring-1 focus:ring-claude-500"
                    />

                    {error && (
                        <p className="text-red-400 text-sm text-center">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={pin.length < 4}
                        className="w-full py-3 bg-claude-500 hover:bg-claude-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
                    >
                        Connect
                    </button>
                </form>
            </div>
        </div>
    );
}
