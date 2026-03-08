import { networkInterfaces } from 'os';

const PWA_BASE = 'https://rohitp-bsf.github.io/claude-mobile-companion/';

/**
 * Auto-detect ngrok tunnel URL via its local API (http://localhost:4040).
 * Returns the public HTTPS URL if found, null otherwise.
 */
async function detectNgrokUrl(port: number): Promise<string | null> {
    try {
        const res = await fetch('http://localhost:4040/api/tunnels', { signal: AbortSignal.timeout(2000) });
        if (!res.ok) return null;
        const data = await res.json() as { tunnels: Array<{ public_url: string; config: { addr: string } }> };
        // Find tunnel pointing to our port
        const tunnel = data.tunnels.find(
            (t) => t.config.addr.includes(String(port)) && t.public_url.startsWith('https://'),
        );
        return tunnel?.public_url || null;
    } catch {
        return null;
    }
}

function buildDeepLink(serverUrl: string, pin: string): string {
    const params = new URLSearchParams({ server: serverUrl, pin });
    return `${PWA_BASE}?${params.toString()}`;
}

export async function printStartupBanner(port: number, pin: string): Promise<void> {
    const localUrl = `http://localhost:${port}`;
    const lanIp = getLanIp();
    const lanUrl = lanIp ? `http://${lanIp}:${port}` : null;

    // Try to detect ngrok
    const ngrokUrl = await detectNgrokUrl(port);

    console.log('\n┌─────────────────────────────────────────────────┐');
    console.log('│     Claude Mobile Companion                     │');
    console.log('├─────────────────────────────────────────────────┤');
    console.log(`│  Local:   ${localUrl.padEnd(38)}│`);
    if (lanUrl) {
        console.log(`│  LAN:     ${lanUrl.padEnd(38)}│`);
    }
    if (ngrokUrl) {
        console.log(`│  ngrok:   ${ngrokUrl.padEnd(38)}│`);
    }
    console.log('├─────────────────────────────────────────────────┤');

    // Pick the best URL for QR (ngrok > LAN > local)
    const serverUrl = ngrokUrl || lanUrl || localUrl;
    const deepLink = buildDeepLink(serverUrl, pin);

    if (ngrokUrl) {
        console.log('│  ngrok detected! Scan QR to auto-connect:       │');
    } else if (lanUrl) {
        console.log('│  Scan QR to auto-connect (same WiFi):            │');
    } else {
        console.log('│  No ngrok or LAN detected.                       │');
        console.log('│  Run: ngrok http 3099                             │');
    }
    console.log('└─────────────────────────────────────────────────┘\n');

    // Print QR code that deep-links to PWA with credentials
    try {
        const qrcode = await import('qrcode-terminal');
        qrcode.generate(deepLink, { small: true }, (qr: string) => {
            console.log(qr);
            console.log(`  Deep link: ${deepLink}\n`);
        });
    } catch {
        console.log(`  Deep link: ${deepLink}\n`);
    }
}

function getLanIp(): string | null {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return null;
}
